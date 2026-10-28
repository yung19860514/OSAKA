// 其他儲值管道通知退款：總平台把那筆紀錄標成「已退款」（重送不會重複處理）。

import { authenticateAgent } from "@/server/agents";
import { db } from "@/server/supabase";

const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(request: Request, { params }: { params: Promise<{ agentOrderId: string }> }) {
  const sb = db();
  if (!sb) return bad("not_configured", 503);
  const { agentOrderId } = await params;
  const raw = await request.text();
  try {
    const agent = await authenticateAgent(sb, request.headers, raw);
    if (!agent) return bad("unauthorized", 401);
    let b: { agentOrderId?: unknown; refundedAt?: unknown; amount?: unknown; reason?: unknown };
    try {
      b = JSON.parse(raw);
    } catch {
      return bad("bad_json");
    }
    // 簽章只涵蓋內容 → 內容裡的訂單編號必須跟網址一致，簽好的退款不能被拿去套到別筆
    if (b.agentOrderId !== agentOrderId) return bad("order_id_mismatch");
    if (typeof b.refundedAt !== "string" || Number.isNaN(Date.parse(b.refundedAt))) return bad("bad_refunded_at");
    const { data: o, error } = await sb.from("orders").select("order_no, total, status").eq("agent_id", agent.id).eq("agent_order_id", agentOrderId).maybeSingle();
    if (error) throw Object.assign(new Error("order_read_failed"), { cause: error });
    if (!o) return bad("not_found", 404);
    if (o.status === "refunded") return Response.json({ agentOrderId, recordId: o.order_no, status: "refunded", duplicate: true });
    // 規格：只能整筆退款
    if (b.amount !== o.total) return bad("amount_mismatch");
    const reason = typeof b.reason === "string" ? b.reason.slice(0, 64) : null;
    const { error: e2 } = await sb
      .from("orders")
      .update({ status: "refunded", refunded_at: new Date(b.refundedAt).toISOString(), refund_amount: o.total })
      .eq("order_no", o.order_no)
      .neq("status", "refunded");
    if (e2) throw Object.assign(new Error("refund_update_failed"), { cause: e2 });
    const log = await sb.from("payment_events").insert({ provider: `agent:${agent.id}`, order_no: o.order_no, event: "refund", payload: { agentOrderId, reason }, result: "refunded" });
    if (log.error) console.error("[agents] 退款紀錄寫入失敗（退款已完成）", o.order_no, log.error.message);
    return Response.json({ agentOrderId, recordId: o.order_no, status: "refunded", duplicate: false });
  } catch (e) {
    console.error("[agents] 退款處理失敗", agentOrderId, e, (e as { cause?: unknown }).cause);
    return bad("server_error", 500);
  }
}
