// 查一筆訂單有沒有繳費（向黑貓 PAY 查證；不採信前端或通知內容）。
// 「已付款」＝黑貓 PAY 狀態為已繳納，而且實際繳款金額等於訂單金額。
// ⏳ 資料庫接上後改成查自己的訂單表（由繳費通知更新），並確認訂單屬於登入中的玩家。

import { CcatError, queryCvsOrder } from "@/server/payments/ccat";
import { paymentMode } from "@/server/payments";

const ORDER_NO = /^P\d{12}[A-Z2-9]{12}$/;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ORDER_NO.test(id)) return Response.json({ error: "bad_order" }, { status: 400 });
  const mode = paymentMode();
  if (mode.kind !== "ccat") return Response.json({ error: "payment_not_configured" }, { status: 503 });
  try {
    const s = await queryCvsOrder(mode.cfg, id);
    if (s.state === "review" || s.state === "unknown") console.error("[ccat] 訂單需要人工對帳", id, s.processCode, s.orderAmount, s.payAmount);
    return Response.json({ orderId: id, status: s.state, paidAt: s.state === "paid" ? s.payDate : undefined }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[ccat] 查單失敗", id, e instanceof CcatError ? `${e.message} ${JSON.stringify(e.detail)}` : e);
    return Response.json({ error: "query_failed" }, { status: 502 });
  }
}
