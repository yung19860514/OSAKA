// 會員（平台帳號）。一個平台帳號 = 通行證，進到每款遊戲時自動建立該遊戲的遊戲帳號。
//
// cloudAuth：Supabase 帳號系統（有設 NEXT_PUBLIC_SUPABASE_URL／ANON_KEY 就用，正式網站與本機都是）。
// mockAuth：「模擬會員系統」—— 帳號存在這台電腦的瀏覽器，只在本機開發、沒設 Supabase 時啟用。
// 畫面與遊戲端都只認 AuthAdapter 介面。登入方式：Email（Google、LINE 之後加）。
//
// 註冊只需要 Email＋密碼（老闆 2026-10-07：不收手機）；暱稱預設取 Email @ 前面，之後可在會員中心修改。

import { GAME_SAVE_KEYS, scopedKey, sessionUserId, switchSession } from "./scope";
import { loadPrefs } from "./prefs";
import { authHeaders, cloudConfigured, supabase } from "./supabaseClient";

export type PlatformUser =
  | { kind: "guest"; id: string; name: string }
  | { kind: "member"; id: string; name: string; email: string; regionId: string; createdAt: string };

export type AuthError =
  | "bad_email"
  | "weak_password"
  | "email_taken"
  | "bad_credentials"
  | "bad_name"
  | "not_signed_in"
  | "not_available"
  /** 註冊成功，但要先到信箱點確認連結才能登入 */
  | "check_email"
  | "email_not_confirmed"
  | "rate_limited"
  | "network";

export type AuthResult = { ok: true; user: PlatformUser } | { ok: false; error: AuthError };

export interface AuthAdapter {
  /** 會員系統是否已開放（false = 只能用訪客身分） */
  enabled: boolean;
  /** mock＝模擬（資料存本機）；cloud＝正式；none＝未開放 */
  mode: "mock" | "cloud" | "none";
  currentUser(): PlatformUser;
  signUp(input: { email: string; password: string }): Promise<AuthResult>;
  signIn(input: { email: string; password: string }): Promise<AuthResult>;
  signOut(): Promise<void>;
  updateProfile(patch: { name?: string }): Promise<AuthResult>;
  changePassword(oldPassword: string, newPassword: string): Promise<AuthResult>;
  /** 刪除帳號（要再輸入一次密碼確認），連同這個帳號在各遊戲的資料 */
  deleteAccount(password: string): Promise<AuthResult>;
  /** 登入狀態改變時通知（含其他分頁） */
  subscribe(fn: () => void): () => void;
  /** 忘記密碼：寄重設密碼信（不論 Email 有沒有註冊都回成功，不洩漏會員名單） */
  requestPasswordReset(email: string): Promise<{ ok: boolean; error?: AuthError }>;
  /** 從重設密碼信的連結進來後，設定新密碼 */
  setNewPassword(password: string): Promise<AuthResult>;
}

// ---------- 共用檢查 ----------

export const MIN_PASSWORD = 8;
export const normEmail = (e: string) => e.trim().toLowerCase();
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normEmail(e)) && normEmail(e).length <= 254;
export const validPassword = (p: string) => typeof p === "string" && p.length >= MIN_PASSWORD && p.length <= 128 && /[A-Za-z]/.test(p) && /\d/.test(p);
const defaultName = (email: string) => normEmail(email).split("@")[0].slice(0, 16) || "player";

function guestUser(): PlatformUser {
  const { guestId } = loadPrefs();
  return { kind: "guest", id: guestId, name: `GUEST-${guestId.slice(0, 4).toUpperCase()}` };
}

// ---------- 模擬會員系統（資料存本機） ----------

const USERS_KEY = "platform.users.v1";
const EVENT = "platform-auth";

interface StoredUser {
  id: string;
  email: string;
  name: string;
  regionId: string;
  createdAt: string;
  salt: string;
  hash: string;
}

function readUsers(): Record<string, StoredUser> {
  try {
    const d = JSON.parse(localStorage.getItem(USERS_KEY) ?? "{}") as Record<string, StoredUser>;
    return d && typeof d === "object" ? d : {};
  } catch {
    return {};
  }
}

function writeUsers(users: Record<string, StoredUser>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** 密碼不存明碼：PBKDF2（10 萬次）＋隨機鹽 */
async function hashPassword(password: string, saltHex: string): Promise<string> {
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, key, 256);
  return toHex(bits);
}

/** 比對雜湊（逐字比對到最後，不提早結束） */
function sameHash(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const toMember = (u: StoredUser): PlatformUser => ({
  kind: "member",
  id: u.id,
  name: u.name,
  email: u.email,
  regionId: u.regionId,
  createdAt: u.createdAt,
});

let cached: PlatformUser | null = null;
function notify() {
  cached = null;
  window.dispatchEvent(new Event(EVENT));
}

/** 註冊時把訪客在各遊戲的進度帶到新帳號（新帳號還沒有存檔才帶） */
function migrateGuestProgress(userId: string) {
  for (const base of GAME_SAVE_KEYS) {
    try {
      const guest = localStorage.getItem(scopedKey(base, null));
      const target = scopedKey(base, userId);
      if (guest && !localStorage.getItem(target)) localStorage.setItem(target, guest);
    } catch {
      // 帶不過去就從新帳號重新開始
    }
  }
}

function findByEmail(users: Record<string, StoredUser>, email: string) {
  const e = normEmail(email);
  return Object.values(users).find((u) => u.email === e);
}

const mockAuth: AuthAdapter = {
  enabled: true,
  mode: "mock",

  currentUser() {
    if (cached) return cached;
    const id = sessionUserId();
    const u = id ? readUsers()[id] : undefined;
    if (id && !u) switchSession(null, { dropPrev: true }); // 帳號已被刪除 → 登出
    cached = u ? toMember(u) : guestUser();
    return cached;
  },

  async signUp({ email, password }) {
    if (!validEmail(email)) return { ok: false, error: "bad_email" };
    if (!validPassword(password)) return { ok: false, error: "weak_password" };
    const users = readUsers();
    if (findByEmail(users, email)) return { ok: false, error: "email_taken" };
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    const u: StoredUser = {
      id: crypto.randomUUID(),
      email: normEmail(email),
      name: defaultName(email),
      regionId: "tw",
      createdAt: new Date().toISOString(),
      salt,
      hash: await hashPassword(password, salt),
    };
    writeUsers({ ...users, [u.id]: u });
    migrateGuestProgress(u.id);
    switchSession(u.id, { inherit: true });
    notify();
    return { ok: true, user: toMember(u) };
  },

  async signIn({ email, password }) {
    const u = findByEmail(readUsers(), email);
    // 帳號不存在也要算一次雜湊，回應時間才不會洩漏「這個 Email 有沒有註冊」
    const hash = await hashPassword(password, u?.salt ?? "00".repeat(16));
    if (!u || !sameHash(hash, u.hash)) return { ok: false, error: "bad_credentials" };
    switchSession(u.id);
    notify();
    return { ok: true, user: toMember(u) };
  },

  async signOut() {
    switchSession(null);
    notify();
  },

  async updateProfile({ name }) {
    const id = sessionUserId();
    const users = readUsers();
    const u = id ? users[id] : undefined;
    if (!u) return { ok: false, error: "not_signed_in" };
    if (name !== undefined) {
      const n = name.trim();
      if (n.length < 1 || n.length > 16) return { ok: false, error: "bad_name" };
      u.name = n;
    }
    writeUsers(users);
    notify();
    return { ok: true, user: toMember(u) };
  },

  async changePassword(oldPassword, newPassword) {
    const id = sessionUserId();
    const users = readUsers();
    const u = id ? users[id] : undefined;
    if (!u) return { ok: false, error: "not_signed_in" };
    if (!sameHash(await hashPassword(oldPassword, u.salt), u.hash)) return { ok: false, error: "bad_credentials" };
    if (!validPassword(newPassword)) return { ok: false, error: "weak_password" };
    u.salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    u.hash = await hashPassword(newPassword, u.salt);
    writeUsers(users);
    return { ok: true, user: toMember(u) };
  },

  async deleteAccount(password) {
    const id = sessionUserId();
    const users = readUsers();
    const u = id ? users[id] : undefined;
    if (!u) return { ok: false, error: "not_signed_in" };
    if (!sameHash(await hashPassword(password, u.salt), u.hash)) return { ok: false, error: "bad_credentials" };
    delete users[u.id];
    writeUsers(users);
    for (const base of [...GAME_SAVE_KEYS, GAME_ACCOUNTS_KEY]) {
      try {
        localStorage.removeItem(scopedKey(base, u.id));
      } catch {
        // 刪不掉的殘留資料沒有帳號對應，不會再被讀到
      }
    }
    switchSession(null, { dropPrev: true });
    notify();
    return { ok: true, user: guestUser() };
  },

  async requestPasswordReset() {
    return { ok: false, error: "not_available" };
  },
  async setNewPassword() {
    return { ok: false, error: "not_available" };
  },

  subscribe(fn) {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === USERS_KEY || e.key === "platform.session.v1") {
        cached = null;
        fn();
      }
    };
    window.addEventListener(EVENT, fn);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, fn);
      window.removeEventListener("storage", onStorage);
    };
  },
};

/** 正式環境還沒有雲端會員系統：只能用訪客身分 */
const noAuth: AuthAdapter = {
  enabled: false,
  mode: "none",
  currentUser: () => (cached ??= guestUser()),
  signUp: async () => ({ ok: false, error: "not_available" }),
  signIn: async () => ({ ok: false, error: "not_available" }),
  signOut: async () => {},
  updateProfile: async () => ({ ok: false, error: "not_available" }),
  changePassword: async () => ({ ok: false, error: "not_available" }),
  deleteAccount: async () => ({ ok: false, error: "not_available" }),
  subscribe: () => () => {},
  requestPasswordReset: async () => ({ ok: false, error: "not_available" }),
  setNewPassword: async () => ({ ok: false, error: "not_available" }),
};

// ---------- 雲端會員系統（Supabase） ----------

let cloudUser: PlatformUser | null = null;
let cloudStarted = false;
const cloudListeners = new Set<() => void>();
const cloudNotify = () => cloudListeners.forEach((fn) => fn());

/** Supabase 的錯誤 → 畫面上的錯誤代碼 */
function cloudError(e: { code?: string; status?: number; message?: string } | null | undefined): AuthError {
  const code = e?.code ?? "";
  if (code === "email_not_confirmed") return "email_not_confirmed";
  if (code === "invalid_credentials") return "bad_credentials";
  if (code === "user_already_exists" || code === "email_exists") return "email_taken";
  if (code === "weak_password") return "weak_password";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || e?.status === 429) return "rate_limited";
  if (code === "validation_failed" || code === "email_address_invalid") return "bad_email";
  return "network";
}

/** 依登入狀態載入會員資料（暱稱、地區在 profiles 表） */
async function loadCloudUser(): Promise<void> {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  const u = data.session?.user;
  const prev = cloudUser?.kind === "member" ? cloudUser.id : null;
  if (!u) {
    cloudUser = guestUser();
    if (prev) switchSession(null);
  } else {
    const { data: p, error: pe } = await sb.from("profiles").select("display_name, region_id, created_at").eq("id", u.id).maybeSingle();
    if (pe) console.error("[auth] 讀取會員資料失敗，暫用預設值", pe.message);
    const email = u.email ?? "";
    cloudUser = {
      kind: "member",
      id: u.id,
      name: (p?.display_name as string | null) || defaultName(email),
      email,
      regionId: (p?.region_id as string | undefined) ?? "tw",
      createdAt: (p?.created_at as string | undefined) ?? u.created_at,
    };
    if (prev !== u.id) {
      // 這台裝置第一次登入這個帳號：訪客的進度帶過去（帳號已有存檔就不蓋）
      const fresh = sessionUserId() === null;
      if (fresh) migrateGuestProgress(u.id);
      switchSession(u.id, { inherit: fresh });
    }
  }
  cloudNotify();
}

function startCloud() {
  if (cloudStarted || typeof window === "undefined") return;
  cloudStarted = true;
  void loadCloudUser();
  supabase().auth.onAuthStateChange((event) => {
    // 交給下一輪處理：在這個回呼裡直接呼叫 Supabase 會卡住
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "INITIAL_SESSION") setTimeout(() => void loadCloudUser(), 0);
  });
}

/** 刪除帳號、改密碼前再確認一次密碼 */
async function verifyPassword(password: string): Promise<boolean> {
  const email = cloudUser?.kind === "member" ? cloudUser.email : "";
  if (!email) return false;
  const { error } = await supabase().auth.signInWithPassword({ email, password });
  return !error;
}

const siteUrl = () => (typeof window === "undefined" ? "" : window.location.origin);

const cloudAuth: AuthAdapter = {
  enabled: true,
  mode: "cloud",

  currentUser() {
    startCloud();
    return (cloudUser ??= guestUser());
  },

  async signUp({ email, password }) {
    if (!validEmail(email)) return { ok: false, error: "bad_email" };
    if (!validPassword(password)) return { ok: false, error: "weak_password" };
    const { data, error } = await supabase().auth.signUp({
      email: normEmail(email),
      password,
      options: { data: { display_name: defaultName(email) }, emailRedirectTo: `${siteUrl()}/account` },
    });
    if (error) return { ok: false, error: cloudError(error) };
    // 開了「Email 確認」時，已註冊的 Email 會回一個沒有登入方式的帳號（不直接說「已註冊」）
    if (data.user && data.user.identities?.length === 0) return { ok: false, error: "email_taken" };
    if (!data.session) return { ok: false, error: "check_email" };
    await loadCloudUser();
    return { ok: true, user: cloudUser! };
  },

  async signIn({ email, password }) {
    const { error } = await supabase().auth.signInWithPassword({ email: normEmail(email), password });
    if (error) return { ok: false, error: cloudError(error) };
    await loadCloudUser();
    return { ok: true, user: cloudUser! };
  },

  async signOut() {
    await supabase().auth.signOut();
    await loadCloudUser();
  },

  async updateProfile({ name }) {
    if (cloudUser?.kind !== "member") return { ok: false, error: "not_signed_in" };
    if (name !== undefined) {
      const n = name.trim();
      if (n.length < 1 || n.length > 16) return { ok: false, error: "bad_name" };
      const { error } = await supabase().from("profiles").update({ display_name: n }).eq("id", cloudUser.id);
      if (error) return { ok: false, error: "network" };
    }
    await loadCloudUser();
    return { ok: true, user: cloudUser };
  },

  async changePassword(oldPassword, newPassword) {
    if (cloudUser?.kind !== "member") return { ok: false, error: "not_signed_in" };
    if (!validPassword(newPassword)) return { ok: false, error: "weak_password" };
    if (!(await verifyPassword(oldPassword))) return { ok: false, error: "bad_credentials" };
    const { error } = await supabase().auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: cloudError(error) };
    return { ok: true, user: cloudUser };
  },

  async deleteAccount(password) {
    if (cloudUser?.kind !== "member") return { ok: false, error: "not_signed_in" };
    if (!(await verifyPassword(password))) return { ok: false, error: "bad_credentials" };
    let res: Response;
    try {
      res = await fetch("/api/account", { method: "DELETE", headers: { "content-type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ password }) });
    } catch {
      return { ok: false, error: "network" };
    }
    if (res.status === 403) return { ok: false, error: "bad_credentials" };
    if (res.status === 429) return { ok: false, error: "rate_limited" };
    if (!res.ok) return { ok: false, error: "network" };
    const id = cloudUser.id;
    for (const base of [...GAME_SAVE_KEYS, GAME_ACCOUNTS_KEY]) {
      try {
        localStorage.removeItem(scopedKey(base, id));
      } catch {
        // 刪不掉的殘留資料沒有帳號對應，不會再被讀到
      }
    }
    switchSession(null, { dropPrev: true });
    await supabase().auth.signOut();
    await loadCloudUser();
    return { ok: true, user: guestUser() };
  },

  subscribe(fn) {
    startCloud();
    cloudListeners.add(fn);
    return () => {
      cloudListeners.delete(fn);
    };
  },

  async requestPasswordReset(email) {
    if (!validEmail(email)) return { ok: false, error: "bad_email" };
    const { error } = await supabase().auth.resetPasswordForEmail(normEmail(email), { redirectTo: `${siteUrl()}/account/reset` });
    if (error && cloudError(error) === "rate_limited") return { ok: false, error: "rate_limited" };
    return { ok: true };
  },

  async setNewPassword(password) {
    if (!validPassword(password)) return { ok: false, error: "weak_password" };
    const { error } = await supabase().auth.updateUser({ password });
    if (error) return { ok: false, error: cloudError(error) };
    await loadCloudUser();
    return cloudUser?.kind === "member" ? { ok: true, user: cloudUser } : { ok: false, error: "not_signed_in" };
  },
};

// 有設 Supabase＝正式會員系統；沒設時本機開發用模擬會員（正式網站不會出現「假註冊」）
export const auth: AuthAdapter = cloudConfigured ? cloudAuth : process.env.NODE_ENV === "production" ? noAuth : mockAuth;

// ---------- 遊戲帳號 ----------

const GAME_ACCOUNTS_KEY = "platform.gameAccounts.v1";

/** 這個平台帳號在各遊戲的遊戲帳號（遊戲代號 → 建立時間） */
export function gameAccounts(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(scopedKey(GAME_ACCOUNTS_KEY)) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * 進入遊戲前呼叫：這個平台帳號在該遊戲還沒有遊戲帳號就自動建立（玩家不用另外註冊）。
 * ⏳ 之後改成呼叫伺服器（遊戲帳號存資料庫，key = 平台帳號 + 遊戲代號）。
 */
export function ensureGameAccount(gameId: string): { gameId: string; createdAt: string; created: boolean } {
  const all = gameAccounts();
  if (all[gameId]) return { gameId, createdAt: all[gameId], created: false };
  const createdAt = new Date().toISOString();
  try {
    localStorage.setItem(scopedKey(GAME_ACCOUNTS_KEY), JSON.stringify({ ...all, [gameId]: createdAt }));
  } catch {
    // 存不了就下次再建立
  }
  return { gameId, createdAt, created: true };
}
