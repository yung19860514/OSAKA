// 會員（平台帳號）。一個平台帳號 = 通行證，進到每款遊戲時自動建立該遊戲的遊戲帳號。
//
// 目前：「模擬會員系統」（mockAuth）—— 帳號存在這台電腦的瀏覽器，只在本機開發時啟用。
// ⏳ 總公司開好 Supabase 後：新增 supabaseAuth（實作同一組 AuthAdapter 介面），把 `auth` 換掉即可，
//    畫面與遊戲端不用改。登入方式預計：Email、Google、LINE。
//
// 註冊只需要 Email＋密碼（老闆 2026-10-07：不收手機）；暱稱預設取 Email @ 前面，之後可在會員中心修改。

import { GAME_SAVE_KEYS, scopedKey, sessionUserId, switchSession } from "./scope";
import { loadPrefs } from "./prefs";

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
  | "not_available";

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
};

// 模擬會員只在本機開發啟用（正式網站不會出現「假註冊」）
export const auth: AuthAdapter = process.env.NODE_ENV === "production" ? noAuth : mockAuth;

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
