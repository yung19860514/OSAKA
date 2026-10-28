// 發貨認領：已付款的訂單只能被「認領發貨」一次（換裝置、重複點、多個分頁都不會重複發）。
// claim：已付款 → 已發貨（回 first: true 才發貨）。
// fail：玩家端回報發貨失敗（例：道具已擁有）→ 訂單維持「已發貨」，只記一筆給客服查證
//   （不能讓玩家自己宣稱失敗就把訂單丟回補發/退款，客服要先核對遊戲裡實際有沒有拿到）。
//   ⛔ 不提供「退回再領」：否則可以 領取→退回→再領取 無限拿道具。
// ⏳ 道具改存伺服器後，發貨直接在伺服器做，這支就只剩查詢用。

import { db, logPaymentEvent, userFromRequest } from "@/server/supabase";
import { getOrder, transition } from "@/server/orders";

const ORDER_NO = /^P\d{12}[A-Z2-9]{12}$/;
const deployed = () => process.env.NODE_ENV === "production" || !!process.env.VERCEL_ENV;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ORDER_NO.test(id)) return Response.json({ error: "bad_order" }, { status: 400 });
  const sb = db();
  if (!sb) return Response.json({ error: "not_configured" }, { status: 503 });
  const user = await userFromRequest(request);
  if (!user) return Response.json({ error: "login_required" }, { status: 401 });
  const action = ((await request.json().catch(() => ({}))) as { action?: string }).action;
  try {
    const o = await getOrder(sb, id);
    if (!o || o.user_id !== user.id) return Response.json({ error: "not_found" }, { status: 404 });
    if (action === "fail") {
      // 只接受剛認領 10 分鐘內的回報，避免事後把正常訂單改成待處理
      const recent = o.status === "delivered" && o.delivered_at && Date.now() - Date.parse(o.delivered_at) < 10 * 60_000;
      if (recent) {
        await logPaymentEvent({ provider: "platform", orderNo: id, event: "delivery_failed_reported", result: "needs_support" });
        console.error("[orders] 玩家回報發貨失敗，待客服查證", id);
      }
      return Response.json({ ok: !!recent });
    }
    if (action !== "claim") return Response.json({ error: "bad_action" }, { status: 400 });
    // 本機開發的模擬訂單：按「模擬已繳費」＝直接視為已付款
    const from: ("pending" | "paid")[] = o.payment_provider === "mock" && !deployed() ? ["pending", "paid"] : ["paid"];
    const first = await transition(sb, id, from, { status: "delivered", delivered_at: new Date().toISOString(), ...(o.status === "pending" ? { paid_at: new Date().toISOString(), paid_amount: o.total } : {}) });
    return Response.json({ first, status: first ? "delivered" : o.status });
  } catch (e) {
    console.error("[orders] 發貨認領失敗", id, e, (e as { cause?: unknown }).cause);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
