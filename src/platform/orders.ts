// 訂單與金流（平台共用；各遊戲的商店都走這裡結帳）。
// 付款方式：超商代碼繳費（老闆 2026-10-07：目前只做超商繳款）。
// 流程：前端送「商品編號＋數量」→ 伺服器依地區售價表算價、建立訂單、取得繳費代碼
//      → 玩家到超商繳費 → 金流商通知伺服器「已繳費」→ 伺服器發貨、開電子發票。
// 金流商：黑貓 PAY（伺服器端 src/server/payments）。開了總開關才發真的 ibon 代碼；本機開發用「模擬」按鈕。
// ⏳ 目前訂單紀錄存在這台裝置、到帳後在這裡發貨（開發替身）；資料庫接上後改由伺服器收到繳費通知時發貨。

import { parseSku, skuOf, type Cart, type Purchase } from "@/game/shop";
import { auth } from "./auth";
import { authHeaders, cloudConfigured } from "./supabaseClient";
import { normalizeWallet, type Wallet } from "@/game/wallet";

export interface OrderLine {
  sku: string;
  qty: number;
  unitPrice: number;
  purchase: Purchase;
}

export type OrderStatus = "pending" | "paid" | "expired";

export interface Order {
  orderId: string;
  /** 下單的平台帳號 */
  userId: string;
  /** 哪款遊戲的訂單（營收依遊戲拆分） */
  gameId: string;
  regionId: string;
  currency: string;
  lines: OrderLine[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  payment: {
    method: "cvs";
    /** ccat＝黑貓 PAY；mock＝本機開發模擬（舊訂單沒有這欄） */
    provider?: "ccat" | "mock";
    store: string;
    /** 超商繳費代碼 */
    code: string;
    /** 手機開啟顯示 ibon 條碼的網址（黑貓 PAY 提供） */
    barcodeUrl?: string;
    expiresAt: string;
    /** 開發用模擬代碼（不能拿去超商繳） */
    mock: boolean;
  };
}

export type CreateOrderError = "amount_out_of_range" | "payment_not_configured" | "payment_failed" | "login_required" | "email_not_confirmed" | "bad_mobile" | "failed";

/** 台灣手機：09 開頭 10 碼（空白、減號自動去掉） */
export const normalizeMobile = (s: string) => s.replace(/[\s-]/g, "");
export const isTwMobile = (s: string) => /^09\d{8}$/.test(normalizeMobile(s));

/** 結帳總開關（跟伺服器的 PAYMENTS_LIVE 一起開：Vercel 環境變數 NEXT_PUBLIC_PAYMENTS_LIVE=1） */
export const paymentLive = process.env.NEXT_PUBLIC_PAYMENTS_LIVE === "1";

/** 建立訂單（價格由伺服器算），回傳含超商繳費代碼的訂單；需要登入（Email 用來寄繳費通知與電子發票） */
export async function createOrder(gameId: string, cart: Cart, payer: { mobile?: string } = {}): Promise<Order> {
  const user = auth.currentUser();
  if (auth.enabled && user.kind !== "member") throw new Error("login_required");
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({
      gameId,
      buyer: user.kind === "member" ? { email: user.email, mobile: payer.mobile ? normalizeMobile(payer.mobile) : undefined } : undefined,
      lines: cart.map((l) => ({ sku: skuOf(l.p), qty: l.qty })),
    }),
  });
  if (!res.ok) {
    const err = ((await res.json().catch(() => ({}))) as { error?: string }).error;
    // 伺服器要求繳款人 Email（bad_buyer）＝要先登入會員
    if (err === "bad_buyer") throw new Error("login_required");
    const known: string[] = ["amount_out_of_range", "payment_not_configured", "payment_failed", "login_required", "email_not_confirmed", "bad_mobile"];
    throw new Error(err && known.includes(err) ? err : "failed");
  }
  const data = (await res.json()) as Omit<Order, "lines" | "gameId" | "createdAt" | "userId"> & { lines: Omit<OrderLine, "purchase">[] };
  const order: Order = {
    ...data,
    userId: user.id,
    gameId,
    createdAt: new Date().toISOString(),
    lines: data.lines.map((l) => ({ ...l, purchase: parseSku(l.sku)! })),
  };
  saveOrder(order);
  return order;
}

// ---------- 本機訂單紀錄（開發替身；之後改成向伺服器查詢） ----------

const KEY = "platform.orders.v1";

function readAll(): Order[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Order[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeAll(list: Order[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
  } catch {
    // 存不了就只在這次瀏覽有效
  }
}

function saveOrder(o: Order) {
  writeAll([o, ...readAll().filter((x) => x.orderId !== o.orderId)]);
}

/** 目前帳號的訂單（新到舊；不給 gameId＝全部遊戲）；超過繳費期限的待繳訂單自動標成逾期 */
export function listOrders(gameId?: string, now = Date.now()): Order[] {
  const all = readAll();
  let changed = false;
  for (const o of all) {
    if (o.status === "pending" && Date.parse(o.payment.expiresAt) < now) {
      o.status = "expired";
      changed = true;
    }
  }
  if (changed) writeAll(all);
  const me = auth.currentUser();
  // 舊的訂單沒有記帳號 → 視為這台裝置訪客的
  const mine = (o: Order) => (o.userId ? o.userId === me.id : me.kind === "guest");
  return all.filter((o) => mine(o) && (!gameId || o.gameId === gameId));
}

export function setOrderStatus(orderId: string, status: OrderStatus) {
  writeAll(readAll().map((o) => (o.orderId === orderId ? { ...o, status } : o)));
}

/**
 * 標成已付款，只會成功一次（重複查詢、連點都不會重複發貨）。
 * 逾期的也可以：玩家可能在期限當天繳了，但這台裝置晚一點才查到。
 */
export function markPaidOnce(orderId: string): boolean {
  const all = readAll();
  const o = all.find((x) => x.orderId === orderId);
  if (!o || o.status === "paid") return false;
  o.status = "paid";
  writeAll(all);
  return true;
}

/** review＝已繳但金額要人工對帳；closed＝伺服器結帳關閉中；error＝暫時查不到 */
export type PayCheck = "paid" | "pending" | "review" | "expired" | "cancelled" | "closed" | "unknown" | "error";

/** 向伺服器查這筆訂單繳費了沒（伺服器再向黑貓 PAY 查證） */
export async function checkPaid(orderId: string): Promise<PayCheck> {
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: "no-store", headers: await authHeaders() });
    if (res.status === 503) return "closed";
    if (!res.ok) return "error";
    const s = ((await res.json()) as { status?: string }).status;
    // delivered＝別的裝置（或之前）已經認領發貨過了，在這裡視為已付款，由 claimDelivery 決定要不要發
    if (s === "delivered") return "paid";
    return s === "paid" || s === "pending" || s === "review" || s === "expired" || s === "cancelled" ? s : "unknown";
  } catch {
    return "error";
  }
}

/** 黑貓 PAY 的訂單、還沒到帳、7 天內建立 → 打開商店時自動查一次 */
export function ordersToCheck(list: Order[], now = Date.now()): Order[] {
  return list.filter((o) => o.payment.provider === "ccat" && o.status !== "paid" && now - Date.parse(o.createdAt) < 7 * 86400_000);
}

/** 訂單內容換回購物車格式（發貨用） */
export function orderCart(o: Order): Cart {
  return o.lines.map((l) => ({ p: l.purchase, qty: l.qty }));
}

/**
 * 發貨：同一筆訂單只會成功一次。
 * 有資料庫：伺服器直接把商品加進玩家錢包，回傳最新錢包（畫面照著更新就好，不在瀏覽器發）。
 * 沒有資料庫（本機開發）：回 first＝true 時由這台裝置發貨。
 */
export async function claimDelivery(orderId: string): Promise<{ first: boolean; wallet?: Wallet }> {
  if (!cloudConfigured) return { first: markPaidOnce(orderId) };
  const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/delivery`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ action: "claim" }),
  });
  if (!res.ok) throw new Error("claim_failed");
  const data = (await res.json()) as { first?: boolean; status?: string; wallet?: unknown };
  if (data.status === "delivered") markPaidOnce(orderId); // 這台裝置的訂單紀錄也標成已到帳
  return { first: data.first === true, wallet: data.wallet ? normalizeWallet(data.wallet) : undefined };
}

/** 發貨失敗：回報伺服器轉人工處理（客服補發或退款）；沒有資料庫時改回待處理，下次打開商店再發 */
export async function reportDeliveryFailure(orderId: string): Promise<void> {
  if (!cloudConfigured) return setOrderStatus(orderId, "pending");
  await fetch(`/api/orders/${encodeURIComponent(orderId)}/delivery`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ action: "fail" }),
  }).catch((e) => console.error("[orders] 回報發貨失敗時出錯", orderId, e));
}

interface ServerOrder {
  order_no: string;
  game_id: string;
  region_id: string;
  currency: string;
  total: number;
  status: string;
  payment_provider: string | null;
  payment_code: string | null;
  payment_url: string | null;
  expires_at: string | null;
  created_at: string;
  order_items: { sku: string; qty: number; unit_price: number }[];
}

/**
 * 從伺服器同步這個帳號的訂單到這台裝置（伺服器的狀態為準）。
 * 已付款但還沒發貨的，在這台裝置標成「待處理」，打開商店時會自動查證並發貨。
 */
export async function syncOrdersFromServer(gameId: string): Promise<void> {
  if (!cloudConfigured) return;
  const me = auth.currentUser();
  if (me.kind !== "member") return;
  const res = await fetch(`/api/orders?game=${encodeURIComponent(gameId)}`, { cache: "no-store", headers: await authHeaders() });
  if (!res.ok) throw new Error("orders_sync_failed");
  const list = ((await res.json()) as { orders?: ServerOrder[] }).orders ?? [];
  const local = new Map(readAll().map((o) => [o.orderId, o]));
  for (const so of list) {
    const lines = so.order_items.map((l) => ({ sku: l.sku, qty: l.qty, unitPrice: l.unit_price, purchase: parseSku(l.sku) }));
    if (lines.some((l) => !l.purchase)) continue; // 這款遊戲看不懂的商品（例：其他遊戲）不放進這裡
    const status: OrderStatus = so.status === "delivered" ? "paid" : so.status === "pending" || so.status === "paid" || so.status === "review" ? "pending" : "expired";
    const prev = local.get(so.order_no);
    local.set(so.order_no, {
      orderId: so.order_no,
      userId: me.id,
      gameId: so.game_id,
      regionId: so.region_id,
      currency: so.currency,
      lines: lines.map((l) => ({ sku: l.sku, qty: l.qty, unitPrice: l.unitPrice, purchase: l.purchase! })),
      total: so.total,
      // 這台裝置已經發過貨的（paid）就維持，不要改回待處理
      status: prev?.status === "paid" ? "paid" : status,
      createdAt: so.created_at,
      payment: {
        method: "cvs",
        provider: so.payment_provider === "ccat" ? "ccat" : "mock",
        store: prev?.payment.store ?? "7-ELEVEN",
        code: so.payment_code ?? prev?.payment.code ?? "",
        barcodeUrl: so.payment_url ?? prev?.payment.barcodeUrl,
        expiresAt: so.expires_at ?? prev?.payment.expiresAt ?? so.created_at,
        mock: so.payment_provider !== "ccat",
      },
    });
  }
  writeAll([...local.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
}
