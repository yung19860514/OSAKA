// 每個帳號的資料分開存：同一台電腦登入不同帳號，道具、外觀、訂單各自獨立。
// 訪客用原本的存檔位置（相容舊資料）；會員在後面加上帳號編號。
// ⏳ 會員系統上雲端後，這些資料改存伺服器，這個檔案就只剩訪客模式在用。

/** 我們自己的遊戲：存檔位置本身就依帳號分開（scopedKey）。新增遊戲時把它的存檔 key 加進來，註冊時才會把訪客進度帶過去 */
export const GAME_SAVE_KEYS = ["blockblitz.player.v1"];

/**
 * 合作遊戲：存檔位置是寫死的（不知道平台帳號），平台在切換帳號時幫它「換存檔」：
 * 目前登入者的存檔放在原位置，其他帳號的收在「key@帳號」。
 * ⏳ 遊戲方接上單一登入與遊戲伺服器後（串接規格第 6 章），存檔改存他們的伺服器，這裡就拿掉。
 */
export const FIXED_SAVE_KEYS = ["mjys_save"];
/** 同上，但遊戲把存檔拆成很多個「同一個開頭」的 key（例：仙途問道 xtwd_*） */
export const FIXED_SAVE_PREFIXES = ["xtwd_"];

const SESSION_KEY = "platform.session.v1";
const stashKey = (base: string, userId: string | null) => `${base}@${userId ?? "guest"}`;

/** 目前登入的會員編號（沒登入＝null） */
export function sessionUserId(): string | null {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    return id && /^[0-9a-f-]{36}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * 切換登入的帳號（null＝登出成訪客），同時幫合作遊戲換成新帳號的存檔。
 * inherit：新帳號還沒有存檔時，沿用切換前的進度（訪客註冊時用）
 * dropPrev：切換前的帳號已刪除，不用收它的存檔
 */
export function switchSession(next: string | null, opts: { inherit?: boolean; dropPrev?: boolean } = {}) {
  const prev = sessionUserId();
  try {
    if (prev !== next) {
      for (const base of FIXED_SAVE_KEYS) {
        const live = localStorage.getItem(base);
        if (opts.dropPrev) localStorage.removeItem(stashKey(base, prev));
        else if (live !== null) localStorage.setItem(stashKey(base, prev), live);
        const target = localStorage.getItem(stashKey(base, next));
        if (target !== null) localStorage.setItem(base, target);
        else if (opts.inherit && live !== null) localStorage.setItem(base, live);
        else localStorage.removeItem(base);
      }
      for (const prefix of FIXED_SAVE_PREFIXES) {
        const all: string[] = [];
        for (let i = 0; i < localStorage.length; i++) all.push(localStorage.key(i) ?? "");
        const keys = all.filter((k) => k.startsWith(prefix) && !k.includes("@"));
        const live: Record<string, string> = {};
        for (const k of keys) live[k] = localStorage.getItem(k) ?? "";
        const box = (u: string | null) => stashKey(prefix + "*", u);
        if (opts.dropPrev) localStorage.removeItem(box(prev));
        else if (keys.length) localStorage.setItem(box(prev), JSON.stringify(live));
        for (const k of keys) localStorage.removeItem(k);
        const raw = localStorage.getItem(box(next));
        const target = raw ? (JSON.parse(raw) as Record<string, string>) : opts.inherit ? live : {};
        for (const [k, v] of Object.entries(target)) localStorage.setItem(k, v);
      }
    }
    if (next) localStorage.setItem(SESSION_KEY, next);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // 存不了就只在這次瀏覽有效
  }
}

/** 依目前帳號換算存檔位置：訪客＝原 key；會員＝key:會員編號 */
export function scopedKey(base: string, userId: string | null = sessionUserId()): string {
  return userId ? `${base}:${userId}` : base;
}
