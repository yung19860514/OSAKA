// 訂單存取（資料庫）。總平台自己賣的與其他儲值管道回報的訂單都在 orders 表＝對帳的最終紀錄。
// 狀態：pending 待繳費 → paid 已付款 → delivered 已發貨；expired / cancelled / refunded / review（金額不符，人工對帳）

import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OrderStatus = "pending" | "paid" | "delivered" | "expired" | "cancelled" | "refunded" | "review";

export interface OrderRow {
  id: number;
  order_no: string;
  channel: "platform" | "agent";
  user_id: string | null;
  game_id: string;
  region_id: string;
  currency: string;
  total: number;
  status: OrderStatus;
  payment_provider: string | null;
  payment_code: string | null;
  payment_url: string | null;
  expires_at: string | null;
  paid_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

const COLS = "id, order_no, channel, user_id, game_id, region_id, currency, total, status, payment_provider, payment_code, payment_url, expires_at, paid_at, delivered_at, created_at";

export interface LineIn {
  sku: string;
  qty: number;
  unitPrice: number;
  name?: string;
}

/** 新增訂單＋明細（明細失敗就把訂單一起刪掉，不留半筆） */
export async function insertOrder(
  sb: SupabaseClient,
  o: {
    orderNo: string;
    channel: "platform" | "agent";
    userId: string | null;
    gameId: string;
    regionId: string;
    currency: string;
    total: number;
    status: OrderStatus;
    provider?: string;
    expiresAt?: string;
    paidAt?: string;
    agentId?: string;
    agentOrderId?: string;
    raw?: unknown;
  },
  lines: LineIn[],
): Promise<OrderRow> {
  const { data, error } = await sb
    .from("orders")
    .insert({
      order_no: o.orderNo,
      channel: o.channel,
      user_id: o.userId,
      game_id: o.gameId,
      region_id: o.regionId,
      currency: o.currency,
      total: o.total,
      status: o.status,
      payment_provider: o.provider ?? null,
      expires_at: o.expiresAt ?? null,
      paid_at: o.paidAt ?? null,
      paid_amount: o.status === "paid" ? o.total : null,
      agent_id: o.agentId ?? null,
      agent_order_id: o.agentOrderId ?? null,
      raw: o.raw ?? null,
    })
    .select(COLS)
    .single();
  if (error || !data) throw Object.assign(new Error("order_insert_failed"), { cause: error });
  const order = data as OrderRow;
  const { error: e2 } = await sb.from("order_items").insert(lines.map((l) => ({ order_id: order.id, sku: l.sku, name: l.name ?? null, qty: l.qty, unit_price: l.unitPrice })));
  if (e2) {
    const rb = await sb.from("orders").delete().eq("id", order.id);
    if (rb.error) console.error("[db] ⚠️ 訂單明細寫入失敗且回滾失敗，留下沒有明細的訂單，需人工處理", o.orderNo, rb.error.message);
    throw Object.assign(new Error("order_items_insert_failed"), { cause: e2 });
  }
  return order;
}

export async function getOrder(sb: SupabaseClient, orderNo: string): Promise<OrderRow | null> {
  const { data, error } = await sb.from("orders").select(COLS).eq("order_no", orderNo).maybeSingle();
  if (error) throw Object.assign(new Error("order_read_failed"), { cause: error });
  return (data as OrderRow | null) ?? null;
}

/** 只在目前狀態屬於 from 的時候才改（避免把已發貨的單改回已付款之類）；回傳有沒有改到 */
export async function transition(sb: SupabaseClient, orderNo: string, from: OrderStatus[], patch: Record<string, unknown> & { status: OrderStatus }): Promise<boolean> {
  const { data, error } = await sb.from("orders").update(patch).eq("order_no", orderNo).in("status", from).select("id");
  if (error) throw Object.assign(new Error("order_update_failed"), { cause: error });
  return (data?.length ?? 0) > 0;
}

/** 其他管道的紀錄編號：A + 台灣時間 yyMMddHHmmss + 12 碼安全亂數 */
export function newRecordNo(now = new Date()): string {
  const stamp = new Date(now.getTime() + 8 * 3600_000).toISOString().slice(2, 19).replace(/[-T:]/g, "");
  return `A${stamp}${Array.from({ length: 12 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)]).join("")}`;
}
