// 多語系：所有畫面文字集中在這裡。新增語言 = 複製一份字典翻譯即可。
// 用法：const t = useT();  t("menu.start")、t("hud.levelUp", { level: 3 })

"use client";

import { createContext, useContext } from "react";
import { zhTW } from "./zh-TW";
import { en } from "./en";

export type Dict = typeof zhTW;
export type Locale = "zh-TW" | "en";

export const LOCALES: { id: Locale; label: string }[] = [
  { id: "zh-TW", label: "繁體中文" },
  { id: "en", label: "English" },
];

const DICTS: Record<Locale, Dict> = { "zh-TW": zhTW, en };

/** 依瀏覽器語言猜預設語言：中文 → 繁中，其餘 → 英文 */
export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "zh-TW";
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-TW" : "en";
}

export type TFunc = (key: keyof Dict, vars?: Record<string, string | number>) => string;

export function makeT(locale: Locale): TFunc {
  const dict = DICTS[locale] ?? zhTW;
  return (key, vars) => {
    let s: string = dict[key] ?? zhTW[key] ?? String(key);
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

export const I18nContext = createContext<TFunc>(makeT("zh-TW"));
export const useT = () => useContext(I18nContext);
