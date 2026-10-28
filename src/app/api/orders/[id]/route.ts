// 查一筆訂單的狀態。
// 有資料庫：只能查自己的訂單；待繳費的黑貓 PAY 訂單會向黑貓查證並更新資料庫
//   （「已付款」＝黑貓狀態已繳納，而且實繳金額不少於訂單金額；少繳轉 review 人工對帳）。
// 沒資料庫（本機沒填 Supabase）：直接向黑貓查。

import { CcatError, queryCvsOrder } from "@/server/payments/ccat";
import { syncFromCcat } from "@/server/payments/sync";
import { paymentMode } from "@/server/payments";
import { db, userFromRequest } from "@/server/supabase";
import { getOrder } from "@/server/orders";

const ORDER_NO = /^P\d{12}[A-Z2-9]{12}$/;
/** 同一筆訂單 30 秒內最多向黑貓 PAY 查一次（避免被拿來狂打黑貓 API） */
const lastSync = new Map<string, number>();
const noStore = { "cache-control": "no-store" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ORDER_NO.test(id)) return Response.json({ error: "bad_order" }, { status: 400 });
  const mode = paymentMode();
  const sb = db();

  if (sb) {
    const user = await userFromRequest(request);
    if (!user) return Response.json({ error: "login_required" }, { status: 401 });
    try {
      let o = await getOrder(sb, id);
      if (!o || o.user_id !== user.id) return Response.json({ error: "not_found" }, { status: 404 });
      if (o.status === "pending" && o.payment_provider === "ccat" && mode.kind === "ccat" && Date.now() - (lastSync.get(id) ?? 0) > 30_000) {
        lastSync.set(id, Date.now());
        if (lastSync.size > 5000) lastSync.clear();
        await syncFromCcat(mode.cfg, id);
        o = (await getOrder(sb, id)) ?? o;
      }
      return Response.json({ orderId: id, status: o.status, paidAt: o.paid_at ?? undefined }, { headers: noStore });
    } catch (e) {
      console.error("[orders] 查單失敗", id, e instanceof CcatError ? `${e.message} ${JSON.stringify(e.detail)}` : e);
      return Response.json({ error: "query_failed" }, { status: 502 });
    }
  }

  if (mode.kind !== "ccat") return Response.json({ error: "payment_not_configured" }, { status: 503 });
  try {
    const s = await queryCvsOrder(mode.cfg, id);
    if (s.state === "review" || s.state === "unknown") console.error("[ccat] 訂單需要人工對帳", id, s.processCode, s.orderAmount, s.payAmount);
    return Response.json({ orderId: id, status: s.state, paidAt: s.state === "paid" ? s.payDate : undefined }, { headers: noStore });
  } catch (e) {
    console.error("[ccat] 查單失敗", id, e instanceof CcatError ? `${e.message} ${JSON.stringify(e.detail)}` : e);
    return Response.json({ error: "query_failed" }, { status: 502 });
  }
}
