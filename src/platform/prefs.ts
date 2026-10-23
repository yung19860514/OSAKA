// 平台層的本機設定：語言、訪客編號（這台裝置共用，跟登入哪個帳號無關）。

import { detectLocale, type Locale } from "@/i18n";

const KEY = "platform.v1";

export interface PlatformPrefs {
  locale: Locale | null;
  /** 訪客編號（沒有登入時用，換裝置就不同） */
  guestId: string;
}

function read(): PlatformPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<PlatformPrefs>;
      if (typeof d.guestId === "string" && d.guestId) {
        return { locale: d.locale === "en" || d.locale === "zh-TW" ? d.locale : null, guestId: d.guestId };
      }
    }
  } catch {
    // 讀不到（無痕模式等）就用新的
  }
  const fresh: PlatformPrefs = { locale: null, guestId: crypto.randomUUID() };
  write(fresh);
  return fresh;
}

function write(p: PlatformPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // 存不了就只在這次瀏覽有效
  }
}

export function loadPrefs(): PlatformPrefs {
  return read();
}

export function updatePrefs(fn: (p: PlatformPrefs) => PlatformPrefs): PlatformPrefs {
  const next = fn(read());
  write(next);
  return next;
}

/** 全平台共用的語言：平台大廳與各遊戲切換語言都寫這裡 */
export function platformLocale(): Locale {
  return read().locale ?? detectLocale();
}

export function setPlatformLocale(locale: Locale) {
  updatePrefs((p) => ({ ...p, locale }));
}
