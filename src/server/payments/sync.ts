// 向黑貓 PAY 查單並同步到資料庫（查到帳 API 與繳費通知共用）。

import { queryCvsOrder, type CcatConfig, type CvsOrderStatus } from "./ccat";
import { db, logPaymentEvent } from "@/server/supabase";
import { transition } from "@/server/orders";

/** 向黑貓 PAY 查這筆單，依結果更新資料庫（只改「待繳費」的單，不會把已發貨的改回去） */
/** 回傳黑貓的查單結果，加上資料庫裡這筆單現在的狀態（null＝資料庫沒有這筆） */
export async function syncFromCcat(cfg: CcatConfig, orderNo: string): Promise<(CvsOrderStatus & { dbStatus: string | null }) | null> {
  const sb = db();
  if (!sb) return null;
  const s = await queryCvsOrder(cfg, orderNo);
  if (s.state === "paid") {
    await transition(sb, orderNo, ["pending", "expired"], { status: "paid", paid_at: s.payDate ? new Date(s.payDate.replace(" ", "T") + "+08:00").toISOString() : new Date().toISOString(), paid_amount: s.payAmount });
  } else if (s.state === "review" || s.state === "unknown") {
    console.error("[ccat] 訂單需要人工對帳", orderNo, s.processCode, s.orderAmount, s.payAmount);
    await transition(sb, orderNo, ["pending", "expired"], { status: "review", paid_amount: s.payAmount || null });
  } else if (s.state === "expired" || s.state === "cancelled") {
    await transition(sb, orderNo, ["pending"], { status: s.state });
  }
  if (s.state !== "pending") await logPaymentEvent({ provider: "ccat", orderNo, event: "query", payload: s, result: s.state });
  const { data, error } = await sb.from("orders").select("status").eq("order_no", orderNo).maybeSingle();
  if (error) throw Object.assign(new Error("order_read_failed"), { cause: error });
  const dbStatus = (data as { status: string } | null)?.status ?? null;
  // 黑貓說已繳，但資料庫的單被註銷了（例：建單時黑貓那邊其實成功、我們這邊當失敗）→ 轉人工對帳
  if (s.state === "paid" && dbStatus === "cancelled") {
    await transition(sb, orderNo, ["cancelled"], { status: "review", paid_amount: s.payAmount });
    console.error("[ccat] 已註銷的訂單收到繳費，轉人工對帳", orderNo);
    return { ...s, dbStatus: "review" };
  }
  return { ...s, dbStatus };
}
