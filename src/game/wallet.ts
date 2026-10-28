// 方塊消消的「道具錢包」：擁有的造型、道具數量、每日禮物領取日。
// 會員：存在伺服器（player_wallets 表），以伺服器為準；訪客：存在瀏覽器（只能玩，不能買）。
// 這個檔案是伺服器與瀏覽器共用的規則（不碰 localStorage / 畫面）。

import { ITEM_IDS, rollItem, type ItemId as BattleItemId } from "@/multiplayer/shared";
import { grant, isCosmetic, isOwned, MAX_QTY, type Cart } from "./shop";
import type { ItemId, PlayerData } from "./storage";

export interface Wallet {
  ownedSkins: string[];
  ownedPets: string[];
  ownedScenes: string[];
  items: Record<ItemId, number>;
  battleItems: Record<BattleItemId, number>;
  /** 上次領每日禮物的日期（台灣日期 YYYY-MM-DD） */
  dailyGift: string;
  coins: number;
}

export const WALLET_KEYS = ["ownedSkins", "ownedPets", "ownedScenes", "items", "battleItems", "dailyGift", "coins"] as const;

/** 新手禮包：每種對戰道具各 1 個 */
export const STARTER_BATTLE_ITEMS = Object.fromEntries(ITEM_IDS.map((id) => [id, 1])) as Record<BattleItemId, number>;

/** 新帳號的錢包（免費外觀 + 新手道具） */
export const WALLET_DEFAULTS: Wallet = {
  ownedSkins: ["arcade", "aurora", "mono"],
  ownedPets: ["cat"],
  ownedScenes: ["space"],
  items: { revive: 1, bomb: 2 },
  battleItems: STARTER_BATTLE_ITEMS,
  dailyGift: "",
  coins: 0,
};

/** 每日禮物：免費送幾個隨機對戰道具 */
export const DAILY_GIFT_COUNT = 3;

const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length <= 32) : []);

/** 把資料庫或瀏覽器讀到的內容整理成合法的錢包（缺的補預設、免費外觀永遠擁有） */
export function normalizeWallet(raw: unknown): Wallet {
  const w = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Wallet, unknown>>;
  const items = (w.items ?? {}) as Record<string, unknown>;
  const battle = (w.battleItems ?? {}) as Record<string, unknown>;
  return {
    ownedSkins: [...new Set([...WALLET_DEFAULTS.ownedSkins, ...ids(w.ownedSkins)])],
    ownedPets: [...new Set([...WALLET_DEFAULTS.ownedPets, ...ids(w.ownedPets)])],
    ownedScenes: [...new Set([...WALLET_DEFAULTS.ownedScenes, ...ids(w.ownedScenes)])],
    items: { revive: "revive" in items ? count(items.revive) : WALLET_DEFAULTS.items.revive, bomb: "bomb" in items ? count(items.bomb) : WALLET_DEFAULTS.items.bomb },
    battleItems: Object.fromEntries(ITEM_IDS.map((id) => [id, id in battle ? count(battle[id]) : STARTER_BATTLE_ITEMS[id]])) as Record<BattleItemId, number>,
    dailyGift: typeof w.dailyGift === "string" ? w.dailyGift.slice(0, 10) : "",
    coins: count(w.coins),
  };
}

/** 從玩家資料取出錢包部分 */
export const walletOf = (p: PlayerData | Wallet): Wallet => normalizeWallet(Object.fromEntries(WALLET_KEYS.map((k) => [k, p[k]])));

export type UseRequest = { kind: "item"; id: ItemId; qty: number } | { kind: "battle"; id: BattleItemId; qty: number };

/** 使用道具（扣數量）；數量不夠＝null（整批都不扣） */
export function consumeItems(w: Wallet, uses: UseRequest[]): Wallet | null {
  const next: Wallet = { ...w, items: { ...w.items }, battleItems: { ...w.battleItems } };
  for (const u of uses) {
    if (!Number.isInteger(u.qty) || u.qty < 1 || u.qty > 10) return null;
    if (u.kind === "item") {
      if (!(u.id === "revive" || u.id === "bomb") || next.items[u.id] < u.qty) return null;
      next.items[u.id] -= u.qty;
    } else {
      if (!ITEM_IDS.includes(u.id) || (next.battleItems[u.id] ?? 0) < u.qty) return null;
      next.battleItems[u.id] -= u.qty;
    }
  }
  return next;
}

/** 台灣日期 YYYY-MM-DD（每日禮物一天一次，以台灣時間換日） */
export const twToday = (now = Date.now()) => new Date(now + 8 * 3600_000).toISOString().slice(0, 10);

/** 領每日禮物；今天領過＝null */
export function claimDaily(w: Wallet, rand: () => number = Math.random, now = Date.now()): { next: Wallet; gifts: BattleItemId[] } | null {
  const day = twToday(now);
  if (w.dailyGift === day) return null;
  const gifts = Array.from({ length: DAILY_GIFT_COUNT }, () => rollItem(rand));
  const battleItems = { ...w.battleItems };
  for (const g of gifts) battleItems[g] = (battleItems[g] ?? 0) + 1;
  return { next: { ...w, battleItems, dailyGift: day }, gifts };
}

/**
 * 付款到帳：整車發進錢包（任何一項不合法就整筆不發）；不合法＝null。
 * 不看現在的售價（付款之後商品下架或調價，已付的錢照樣要發貨）；外觀已經擁有＝不合法（轉客服退款）。
 */
export function grantCart(w: Wallet, cart: Cart): Wallet | null {
  let next = w as unknown as PlayerData;
  for (const l of cart) {
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_QTY || isOwned(next, l.p)) return null;
    if (isCosmetic(l.p) && l.qty !== 1) return null;
    next = grant(next, l.p, l.qty);
  }
  return walletOf(next as unknown as Wallet);
}
