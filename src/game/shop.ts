// 商店：台幣直接買道具／外觀（第一階段收費方式，老闆 2026-10-07 拍板）。
// 玩家把東西放進購物車 → 一次結帳、一次付款、一張發票 → 付款成功當下全部發貨。
// ⛔ 不可以做「先付錢存成餘額、之後再挑」——那樣就變成預付點數，要做履約保證。
// ⚠️ 目前擁有物存在瀏覽器（開發替身）。接上金流後：結帳＝伺服器建立訂單 → 第三方支付 →
//    付款成功通知回到伺服器 → 伺服器發貨；前端只顯示伺服器結果。

import { REGIONS, type Region } from "@/config/regions";
import { ITEMS, ITEM_IDS, type ItemId as BattleItemId } from "@/multiplayer/shared";
import type { ItemId as SingleItemId, PlayerData } from "./storage";

/** 平台上的遊戲代號（商品編號前綴，平台旗下每款遊戲各一個） */
export const GAME_ID = "blockblitz";

/** 組合包：一次買多種道具，比分開買便宜（內容與價格 ⏳ 暫定） */
export const BUNDLES = {
  supply: { battle: { shield: 3, bomb: 3, rain: 3, cleanse: 2 } as Partial<Record<BattleItemId, number>> },
  rookie: { battle: Object.fromEntries(ITEM_IDS.map((id) => [id, 2])) as Partial<Record<BattleItemId, number>>, single: { revive: 2 } as Partial<Record<SingleItemId, number>> },
} as const;
export type BundleId = keyof typeof BUNDLES;
export const BUNDLE_IDS = Object.keys(BUNDLES) as BundleId[];

export type Purchase =
  | { kind: "skin" | "scene" | "pet"; id: string }
  | { kind: "battle"; id: BattleItemId }
  | { kind: "single"; id: SingleItemId }
  | { kind: "bundle"; id: BundleId };

/** 外觀只能擁有一份；道具與組合包可以買很多份 */
export const isCosmetic = (p: Purchase) => p.kind === "skin" || p.kind === "scene" || p.kind === "pet";

/** 商品編號，例：blockblitz:skin:neon（營收報表依遊戲 × 地區拆分用） */
export const skuOf = (p: Purchase) => `${GAME_ID}:${p.kind}:${p.id}`;

/** 商品編號 → 商品（不認得的回傳 null）；伺服器建立訂單時用 */
export function parseSku(sku: unknown): Purchase | null {
  if (typeof sku !== "string") return null;
  const [game, kind, id, extra] = sku.split(":");
  if (game !== GAME_ID || !id || extra !== undefined) return null;
  if (kind === "skin" || kind === "scene" || kind === "pet") return { kind, id };
  if (kind === "battle" && Object.hasOwn(ITEMS, id)) return { kind, id: id as BattleItemId };
  if (kind === "single" && (id === "revive" || id === "bomb")) return { kind, id };
  if (kind === "bundle" && Object.hasOwn(BUNDLES, id)) return { kind, id: id as BundleId };
  return null;
}

/** 商品名稱在語系檔裡的 key（商店畫面與超商繳費單的商品明細共用） */
export function purchaseNameKey(p: Purchase): string {
  switch (p.kind) {
    case "skin":
      return `skin.${p.id}`;
    case "scene":
      return `scene.${p.id}`;
    case "pet":
      return `pet.${p.id}`;
    case "battle":
      return `item.name.${p.id}`;
    case "single":
      return p.id === "revive" ? "item.revive" : "item.bomb";
    case "bundle":
      return `shop.bundle.${p.id}`;
  }
}

/** 目前玩家所在地區（會員系統上線後改成帳號綁定的地區） */
export function currentRegion(): Region {
  return REGIONS.find((r) => r.id === "tw")!;
}

/** 售價（該地區沒有定價 = 不販售，回傳 null） */
export function priceOf(p: Purchase, region: Region = currentRegion()): number | null {
  const v = region.prices[skuOf(p)];
  return typeof v === "number" && v > 0 ? v : null;
}

export function formatMoney(amount: number, region: Region = currentRegion()) {
  // 用英文格式：台幣才會顯示成 NT$（中文格式只會顯示 $，容易誤會成美金）
  return new Intl.NumberFormat("en", { style: "currency", currency: region.currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
}

export function isOwned(player: PlayerData, p: Purchase): boolean {
  if (p.kind === "skin") return player.ownedSkins.includes(p.id);
  if (p.kind === "scene") return player.ownedScenes.includes(p.id);
  if (p.kind === "pet") return player.ownedPets.includes(p.id);
  return false;
}

// ---------- 購物車 ----------

export interface CartLine {
  p: Purchase;
  qty: number;
}
export type Cart = CartLine[];
/** 單一品項一次最多買幾份 */
export const MAX_QTY = 99;

const same = (a: Purchase, b: Purchase) => a.kind === b.kind && a.id === b.id;

export function qtyInCart(cart: Cart, p: Purchase) {
  return cart.find((l) => same(l.p, p))?.qty ?? 0;
}

/** 加入購物車（外觀最多 1 份、已擁有或不販售的放不進去） */
export function addToCart(cart: Cart, player: PlayerData, p: Purchase, qty = 1): Cart {
  if (priceOf(p) === null || isOwned(player, p)) return cart;
  const cur = qtyInCart(cart, p);
  const next = Math.min(isCosmetic(p) ? 1 : MAX_QTY, cur + qty);
  if (next === cur) return cart;
  return cur ? cart.map((l) => (same(l.p, p) ? { ...l, qty: next } : l)) : [...cart, { p, qty: next }];
}

/** 改數量（0 = 移除） */
export function setQty(cart: Cart, p: Purchase, qty: number): Cart {
  const q = Math.max(0, Math.min(isCosmetic(p) ? 1 : MAX_QTY, Math.floor(qty)));
  return q ? cart.map((l) => (same(l.p, p) ? { ...l, qty: q } : l)) : cart.filter((l) => !same(l.p, p));
}

export function cartTotal(cart: Cart, region: Region = currentRegion()): number {
  let sum = 0;
  for (const l of cart) sum += (priceOf(l.p, region) ?? 0) * l.qty;
  return Math.round(sum * 100) / 100;
}

/** 把一份商品發給玩家 */
function grant(player: PlayerData, p: Purchase, qty: number): PlayerData {
  const add = <K extends string>(rec: Record<K, number>, id: K, n: number) => ({ ...rec, [id]: (rec[id] ?? 0) + n });
  switch (p.kind) {
    case "skin":
      return { ...player, ownedSkins: [...player.ownedSkins, p.id] };
    case "scene":
      return { ...player, ownedScenes: [...player.ownedScenes, p.id] };
    case "pet":
      return { ...player, ownedPets: [...player.ownedPets, p.id] };
    case "battle":
      return { ...player, battleItems: add(player.battleItems, p.id, qty) };
    case "single":
      return { ...player, items: add(player.items, p.id, qty) };
    case "bundle": {
      const b: { battle?: Partial<Record<BattleItemId, number>>; single?: Partial<Record<SingleItemId, number>> } = BUNDLES[p.id];
      let next = player;
      for (const [id, n] of Object.entries(b.battle ?? {})) next = { ...next, battleItems: add(next.battleItems, id as BattleItemId, (n ?? 0) * qty) };
      for (const [id, n] of Object.entries(b.single ?? {})) next = { ...next, items: add(next.items, id as SingleItemId, (n ?? 0) * qty) };
      return next;
    }
  }
}

export type CheckoutResult = { ok: true; next: PlayerData; total: number } | { ok: false; reason: "empty" | "invalid" };

/**
 * 付款成功後發貨：整車一起發（任何一項不合法就整筆不發，不會只發一半）。
 * 已經擁有的外觀會被擋下（避免重複收費）。
 */
export function deliver(player: PlayerData, cart: Cart): CheckoutResult {
  if (!cart.length) return { ok: false, reason: "empty" };
  let next = player;
  for (const l of cart) {
    if (!Number.isInteger(l.qty) || l.qty < 1 || priceOf(l.p) === null || isOwned(next, l.p)) return { ok: false, reason: "invalid" };
    if (isCosmetic(l.p) && l.qty !== 1) return { ok: false, reason: "invalid" };
    next = grant(next, l.p, l.qty);
  }
  return { ok: true, next, total: cartTotal(cart) };
}

/** 金流開通前用「模擬付款」測流程（只有本機 next dev 會出現） */
export const canMockPay = process.env.NODE_ENV === "development";
