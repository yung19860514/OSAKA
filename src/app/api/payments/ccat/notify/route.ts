// 黑貓 PAY 繳費主動通知（APN，規格二-6）。網址填在黑貓 PAY 後台「主動通知服務」或建單時的 apn_url。
// 回純文字 OK＝收到，不再重送；其他回應會每 15 分鐘重送，同一狀態最多 3 次。
// 通知內容的 checksum 沒有密鑰、任何人都偽造得出來 → 「已繳費」一律再用查單 API 向黑貓 PAY 查證。
// ⏳ 資料庫接上後：在這裡把訂單標成已付款並發貨（以訂單號防重複，重送不可重複發貨）。目前到帳由玩家端查單後發貨。

import { apnChecksumOk, ccatConfig, CcatError, isApnBody, queryCvsOrder } from "@/server/payments/ccat";

const ok = () => new Response("OK", { headers: { "content-type": "text/plain" } });

export async function POST(request: Request) {
  const cfg = ccatConfig();
  if (!cfg) return new Response("not configured", { status: 503 });
  const body = await request.json().catch(() => null);
  if (!isApnBody(body) || body.api_id !== cfg.custId || !apnChecksumOk(body)) {
    console.warn("[ccat] 通知格式或檢核碼不符，不處理");
    return new Response("bad request", { status: 400 });
  }
  // 只有「已繳納」需要處理；其他狀態（逾期、註銷、撥款…）收下即可
  if (body.status !== "B") return ok();
  try {
    const s = await queryCvsOrder(cfg, body.order_no);
    if (s.state !== "paid" || s.orderAmount !== Number(body.amount)) {
      console.error("[ccat] 通知說已繳費，但查單結果不符（需要人工對帳）", body.order_no, s.state, s.processCode, s.orderAmount, s.payAmount);
      return new Response("not paid", { status: 409 });
    }
    console.info("[ccat] 已繳費", body.order_no, s.payAmount, s.payDate);
    return ok();
  } catch (e) {
    // 查不到黑貓 PAY：回錯誤讓對方稍後重送
    console.error("[ccat] 查單失敗", body.order_no, e instanceof CcatError ? `${e.message} ${JSON.stringify(e.detail)}` : e);
    return new Response("retry", { status: 502 });
  }
}
