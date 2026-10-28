// 玩家錢包（伺服器端）：讀取、修改、付款到帳發貨。
// 修改一律「讀出版本號 → 計算 → 只在版本沒變時寫回」，兩個請求同時改也不會互相蓋掉（衝突就重試）。

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeWallet, WALLET_DEFAULTS, grantCart, type Wallet } from "@/game/wallet";
import { parseSku } from "@/game/shop";
import { getOrder, transition } from "./orders";
import { logPaymentEvent } from "./supabase";

/** 目前只有方塊消消的道具由總平台保管（合作遊戲的道具在遊戲方自己的伺服器） */
export const WALLET_GAMES = new Set(["blockblitz"]);

export async function getWallet(sb: SupabaseClient, userId: string, gameId: string): Promise<Wallet> {
  const { data, error } = await sb.from("player_wallets").select("data").eq("user_id", userId).eq("game_id", gameId).maybeSingle();
  if (error) throw Object.assign(new Error("wallet_read_failed"), { cause: error });
  if (data) return normalizeWallet(data.data);
  // 第一次：建立新帳號的錢包（同時建立時只會成功一筆）
  const init = structuredClone(WALLET_DEFAULTS);
  const ins = await sb.from("player_wallets").upsert({ user_id: userId, game_id: gameId, data: init }, { onConflict: "user_id,game_id", ignoreDuplicates: true });
  if (ins.error) throw Object.assign(new Error("wallet_create_failed"), { cause: ins.error });
  const again = await sb.from("player_wallets").select("data").eq("user_id", userId).eq("game_id", gameId).single();
  if (again.error) throw Object.assign(new Error("wallet_read_failed"), { cause: again.error });
  return normalizeWallet(again.data.data);
}

/**
 * 修改錢包：fn 回傳新錢包；回傳 null＝不能改（例：道具不夠），原樣不動。
 * 回傳 { wallet, changed }。
 */
export async function mutateWallet(sb: SupabaseClient, userId: string, gameId: string, fn: (w: Wallet) => Wallet | null): Promise<{ wallet: Wallet; changed: boolean }> {
  await getWallet(sb, userId, gameId); // 確保有這筆
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await sb.from("player_wallets").select("data, version").eq("user_id", userId).eq("game_id", gameId).single();
    if (error) throw Object.assign(new Error("wallet_read_failed"), { cause: error });
    const cur = normalizeWallet(data.data);
    const next = fn(cur);
    if (!next) return { wallet: cur, changed: false };
    const upd = await sb
      .from("player_wallets")
      .update({ data: next, version: data.version + 1 })
      .eq("user_id", userId)
      .eq("game_id", gameId)
      .eq("version", data.version)
      .select("version");
    if (upd.error) throw Object.assign(new Error("wallet_update_failed"), { cause: upd.error });
    if (upd.data.length) return { wallet: next, changed: true };
    // 版本變了＝同時有別的修改 → 重讀再算一次
  }
  throw new Error("wallet_busy");
}

/**
 * 付款到帳後發貨（伺服器端）：已付款 → 已發貨（只會成功一次），再把商品加進玩家錢包。
 * 發不進去（例：外觀已經擁有）→ 訂單轉 review，交給客服退款。
 * 回傳 { first: 這次有沒有發, wallet }。
 */
export async function fulfillOrder(sb: SupabaseClient, orderNo: string, opts: { from?: ("pending" | "paid")[] } = {}): Promise<{ first: boolean; wallet?: Wallet; status: string }> {
  const o = await getOrder(sb, orderNo);
  if (!o || !o.user_id) return { first: false, status: o?.status ?? "not_found" };
  if (!WALLET_GAMES.has(o.game_id)) return { first: false, status: o.status };
  // 只發「總平台自己賣出」的訂單（其他儲值管道的紀錄只記帳，道具由對方發）
  if (o.channel !== "platform") return { first: false, status: o.status };
  // 已付款的單：實收金額要足夠（金額不足的早就轉 review，這裡再擋一次）
  if (o.status === "paid" && !(o.paid_amount !== null && o.paid_amount >= o.total)) {
    console.error("[wallet] 實收金額不足，不發貨", orderNo, o.paid_amount, o.total);
    await transition(sb, orderNo, ["paid"], { status: "review" });
    return { first: false, status: "review" };
  }
  const from = opts.from ?? ["paid"];
  const now = new Date().toISOString();
  const first = await transition(sb, orderNo, from, {
    status: "delivered",
    delivered_at: now,
    ...(o.status === "pending" ? { paid_at: now, paid_amount: o.total } : {}),
  });
  if (!first) return { first: false, status: o.status };
  const { data: lines, error } = await sb.from("order_items").select("sku, qty").eq("order_id", o.id);
  if (error) throw Object.assign(new Error("order_items_read_failed"), { cause: error });
  const cart = (lines ?? []).map((l) => ({ p: parseSku(l.sku), qty: l.qty }));
  try {
    if (cart.some((l) => !l.p)) throw new Error("unknown_sku");
    const r = await mutateWallet(sb, o.user_id, o.game_id, (w) => grantCart(w, cart as { p: NonNullable<(typeof cart)[number]["p"]>; qty: number }[]));
    if (!r.changed) throw new Error("grant_rejected");
    await logPaymentEvent({ provider: "platform", orderNo, event: "fulfilled", result: "delivered" });
    return { first: true, wallet: r.wallet, status: "delivered" };
  } catch (e) {
    // 訂單已標成已發貨但道具沒進去 → 轉 review，客服處理（補發或退款）
    console.error("[wallet] 發貨失敗，轉人工處理", orderNo, e);
    await transition(sb, orderNo, ["delivered"], { status: "review" }).catch((err) => console.error("[wallet] 轉人工處理也失敗", orderNo, err));
    await logPaymentEvent({ provider: "platform", orderNo, event: "fulfill_failed", result: String((e as Error).message) });
    return { first: false, status: "review" };
  }
}
