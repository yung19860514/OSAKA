// 黑貓 PAY 繳費主動通知（APN，規格二-6）。網址填在黑貓 PAY 後台「主動通知服務」或建單時的 apn_url。
// 回純文字 OK＝收到，不再重送；其他回應會每 15 分鐘重送，同一狀態最多 3 次。
// 通知內容的 checksum 沒有密鑰、任何人都偽造得出來 → 「已繳費」一律再用查單 API 向黑貓 PAY 查證，
// 有資料庫時順便把訂單更新成已付款（玩家下次打開商店就會到帳）。

import { apnChecksumOk, ccatConfig, CcatError, isApnBody, queryCvsOrder } from "@/server/payments/ccat";
import { syncFromCcat } from "@/server/payments/sync";
import { db, logPaymentEvent } from "@/server/supabase";

const ok = () => new Response("OK", { headers: { "content-type": "text/plain" } });

export async function POST(request: Request) {
  const cfg = ccatConfig();
  if (!cfg) return new Response("not configured", { status: 503 });
  const body = await request.json().catch(() => null);
  if (!isApnBody(body) || body.api_id !== cfg.custId || !apnChecksumOk(body)) {
    console.warn("[ccat] 通知格式或檢核碼不符，不處理");
    return new Response("bad request", { status: 400 });
  }
  await logPaymentEvent({ provider: "ccat", orderNo: body.order_no, event: `apn:${body.status}`, payload: body });
  // 只有「已繳納」需要處理；其他狀態（逾期、註銷、撥款…）收下即可
  if (body.status !== "B") return ok();
  try {
    const s = db() ? await syncFromCcat(cfg, body.order_no) : await queryCvsOrder(cfg, body.order_no);
    // 有資料庫時：資料庫也要確實是已付款／已發貨，才回 OK（否則讓黑貓稍後重送、並留紀錄）
    const dbOk = !db() || (s && "dbStatus" in s && (s.dbStatus === "paid" || s.dbStatus === "delivered"));
    if (!s || s.state !== "paid" || s.orderAmount !== Number(body.amount) || !dbOk) {
      console.error("[ccat] 通知說已繳費，但查單或資料庫結果不符（需要人工對帳）", body.order_no, s?.state, s && "dbStatus" in s ? s.dbStatus : "-", s?.orderAmount, s?.payAmount);
      return new Response("not paid", { status: 409 });
    }
    console.info("[ccat] 已繳費", body.order_no, s.payAmount, s.payDate);
    return ok();
  } catch (e) {
    // 查不到黑貓 PAY 或資料庫暫時故障：回錯誤讓對方稍後重送
    console.error("[ccat] 處理繳費通知失敗", body.order_no, e instanceof CcatError ? `${e.message} ${JSON.stringify(e.detail)}` : e);
    return new Response("retry", { status: 502 });
  }
}
