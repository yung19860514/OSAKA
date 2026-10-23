// 玩家資料（最高分、造型、道具庫存）。
// ⚠️ 目前存在瀏覽器 localStorage，只是開發期的替身。
// 上線儲值後，「擁有哪些造型 / 道具剩幾個 / 遊戲幣餘額」必須改由伺服器記帳，
// 前端只負責顯示——存在瀏覽器的數字玩家改得動，不能拿來當付費依據。

import { DEFAULT_KEYS, type KeyBindings } from "./controls";
import { detectLocale, type Locale } from "@/i18n";
import { loadPrefs } from "@/platform/prefs";
import { scopedKey } from "@/platform/scope";
import { ITEM_IDS, rollItem, type ItemId as BattleItemId } from "@/multiplayer/shared";

export type ItemId = "revive" | "bomb";

export interface PlayerData {
  highScore: number;
  skinId: string;
  ownedSkins: string[];
  items: Record<ItemId, number>;
  keys: KeyBindings;
  sound: { volume: number; muted: boolean };
  startLevel: number;
  petId: string;
  ownedPets: string[];
  sceneId: string;
  ownedScenes: string[];
  locale: Locale;
  /** 對戰暱稱 */
  nickname: string;
  /** 對戰道具背包：每種擁有幾個（出戰時扣除；之後改由伺服器記帳） */
  battleItems: Record<BattleItemId, number>;
  /** 上次領每日禮物的日期（YYYY-MM-DD） */
  dailyGift: string;
  /** 方塊幣餘額（儲值取得、商店花用；不可兌換現金） */
  coins: number;
}

/** 每日禮物：免費送幾個隨機對戰道具 */
export const DAILY_GIFT_COUNT = 3;
/** 本地日期（不用 UTC，避免台灣早上 8 點前算成前一天） */
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** 新手禮包：每種對戰道具各 1 個 */
const STARTER_BATTLE_ITEMS = Object.fromEntries(ITEM_IDS.map((id) => [id, 1])) as Record<BattleItemId, number>;

/** 領每日禮物；今天領過就回傳 null */
export function claimDailyGift(p: PlayerData): { next: PlayerData; gifts: BattleItemId[] } | null {
  if (p.dailyGift === today()) return null;
  const gifts = Array.from({ length: DAILY_GIFT_COUNT }, () => rollItem(Math.random));
  const battleItems = { ...p.battleItems };
  for (const g of gifts) battleItems[g] = (battleItems[g] ?? 0) + 1;
  return { next: { ...p, battleItems, dailyGift: today() }, gifts };
}

// 存檔位置依平台帳號分開（訪客＝原位置；會員＝加上帳號編號），見 platform/scope.ts
const KEY_BASE = "blockblitz.player.v1";

const DEFAULTS: PlayerData = {
  highScore: 0,
  skinId: "arcade",
  ownedSkins: ["arcade", "aurora", "mono"],
  // 開發測試用的起始道具，正式版改為儲值取得
  items: { revive: 1, bomb: 2 },
  keys: DEFAULT_KEYS,
  sound: { volume: 0.6, muted: false },
  startLevel: 1,
  petId: "cat",
  ownedPets: ["cat"],
  sceneId: "space",
  ownedScenes: ["space"],
  locale: "zh-TW",
  nickname: "",
  battleItems: STARTER_BATTLE_ITEMS,
  dailyGift: "",
  coins: 0,
};

export function loadPlayer(): PlayerData {
  try {
    const raw = localStorage.getItem(scopedKey(KEY_BASE));
    // 語言以平台設定為準（平台大廳與各遊戲共用）
    const platformLang = loadPrefs().locale;
    if (!raw) return { ...structuredClone(DEFAULTS), locale: platformLang ?? detectLocale() };
    const data = JSON.parse(raw) as Partial<PlayerData>;
    return {
      ...structuredClone(DEFAULTS),
      ...data,
      items: { ...DEFAULTS.items, ...data.items },
      battleItems: { ...STARTER_BATTLE_ITEMS, ...data.battleItems },
      // 免費造型永遠擁有（新增免費造型時舊存檔也拿得到）
      ownedSkins: [...new Set([...DEFAULTS.ownedSkins, ...(data.ownedSkins ?? [])])],
      ownedPets: [...new Set([...DEFAULTS.ownedPets, ...(data.ownedPets ?? [])])],
      ownedScenes: [...new Set([...DEFAULTS.ownedScenes, ...(data.ownedScenes ?? [])])],
      keys: { ...DEFAULTS.keys, ...data.keys },
      sound: { ...DEFAULTS.sound, ...data.sound },
      locale: platformLang ?? data.locale ?? DEFAULTS.locale,
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function savePlayer(data: PlayerData) {
  try {
    localStorage.setItem(scopedKey(KEY_BASE), JSON.stringify(data));
  } catch {
    // 無痕模式或儲存空間被封鎖時，本局資料只是不會保留，遊戲照常進行
  }
}
