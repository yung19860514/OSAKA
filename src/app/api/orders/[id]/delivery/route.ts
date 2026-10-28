// 發貨：已付款的訂單由伺服器把商品加進玩家錢包（只會發一次；換裝置、重複點、多個分頁都不會重複發）。
// 黑貓 PAY 到帳時伺服器已經自動發了，這支是「玩家打開商店時補確認」與本機開發的模擬付款用。
// claim：發貨（回 first: true＝這次發的，並回傳最新錢包）
// fail：玩家端回報沒收到 → 訂單維持原狀，只記一筆給客服查證（不能玩家自己宣稱就補發／退款）。
//   ⛔ 不提供「退回再領」：否則可以 領取→退回→再領取 無限拿道具。

import { db, logPaymentEvent, userFromRequest } from "@/server/supabase";
import { getOrder } from "@/server/orders";
import { fulfillOrder, getWallet } from "@/server/wallet";

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
      // 只接受剛發貨 10 分鐘內的回報
      const recent = o.status === "delivered" && o.delivered_at && Date.now() - Date.parse(o.delivered_at) < 10 * 60_000;
      if (recent) {
        await logPaymentEvent({ provider: "platform", orderNo: id, event: "delivery_failed_reported", result: "needs_support" });
        console.error("[orders] 玩家回報沒收到，待客服查證", id);
      }
      return Response.json({ ok: !!recent });
    }
    if (action !== "claim") return Response.json({ error: "bad_action" }, { status: 400 });
    // 本機開發的模擬訂單：按「模擬已繳費」＝直接視為已付款
    const from: ("pending" | "paid")[] = o.payment_provider === "mock" && !deployed() ? ["pending", "paid"] : ["paid"];
    const r = await fulfillOrder(sb, id, { from });
    const wallet = r.wallet ?? (await getWallet(sb, user.id, o.game_id));
    return Response.json({ first: r.first, status: r.status, wallet });
  } catch (e) {
    console.error("[orders] 發貨失敗", id, e, (e as { cause?: unknown }).cause);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
