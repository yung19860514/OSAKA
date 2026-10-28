// 其他儲值管道回報訂單（玩家已在對方付款，總平台只記錄，不收款）。規格：docs/代理儲值串接規格.md
// POST：回報一筆已付款訂單（同一個 agentOrderId 重送不會重複記錄）
// GET ?date=YYYY-MM-DD：查某一天（台灣日期、依付款時間）總平台記錄了哪些單，給對方對帳

import { GAMES } from "@/platform/games";
import { authenticateAgent, type AgentRow } from "@/server/agents";
import { insertOrder, newRecordNo } from "@/server/orders";
import { db } from "@/server/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const bad = (error: string, status = 400) => Response.json({ error }, { status });
const AGENT_ORDER_ID = /^[A-Za-z0-9_-]{1,64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Item {
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
}
interface Body {
  agentOrderId: string;
  paidAt: string;
  member: { agentUserId: string; name: string; email: string };
  gameId: string;
  items: Item[];
  amount: number;
  currency: string;
  paymentMethod?: string;
}

/** 檢查內容；有錯回錯誤代碼 */
function validate(b: unknown, agent: AgentRow): string | Body {
  const x = b as Partial<Body> | null;
  if (!x || typeof x !== "object") return "bad_json";
  if (typeof x.agentOrderId !== "string" || !AGENT_ORDER_ID.test(x.agentOrderId)) return "bad_agent_order_id";
  if (typeof x.paidAt !== "string" || Number.isNaN(Date.parse(x.paidAt))) return "bad_paid_at";
  const m = x.member;
  if (!m || typeof m.agentUserId !== "string" || !m.agentUserId || m.agentUserId.length > 64) return "bad_member_id";
  if (typeof m.name !== "string" || !m.name.trim() || m.name.length > 64) return "bad_member_name";
  if (typeof m.email !== "string" || !EMAIL.test(m.email) || m.email.length > 254) return "bad_email";
  if (typeof x.gameId !== "string" || !GAMES.some((g) => g.id === x.gameId)) return "unknown_game";
  if (!Array.isArray(x.items) || x.items.length < 1 || x.items.length > 50) return "bad_items";
  for (const it of x.items) {
    if (!it || typeof it.sku !== "string" || !it.sku.startsWith(`${x.gameId}:`) || it.sku.length > 100) return "bad_sku";
    if (typeof it.name !== "string" || !it.name.trim() || it.name.length > 100) return "bad_item_name";
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 999) return "bad_qty";
    if (!Number.isInteger(it.unitPrice) || it.unitPrice < 0) return "bad_unit_price";
  }
  if (!Number.isInteger(x.amount) || (x.amount as number) <= 0) return "bad_amount";
  if (x.items.reduce((s, it) => s + it.qty * it.unitPrice, 0) !== x.amount) return "total_mismatch";
  if (x.currency !== agent.currency) return "currency_not_allowed";
  if (x.paymentMethod !== undefined && (typeof x.paymentMethod !== "string" || x.paymentMethod.length > 32)) return "bad_payment_method";
  return x as Body;
}

/** 依 Email 找總平台會員，沒有就建立（只建登入帳號，玩家之後用「忘記密碼」設定密碼） */
async function resolveMember(sb: SupabaseClient, agent: AgentRow, m: Body["member"]): Promise<string> {
  const email = m.email.trim().toLowerCase();
  // 登入系統存的 Email 都是小寫 → 用完全相等比對（不用模糊比對，避免 _ % 被當萬用字元）
  const found = await sb.from("profiles").select("id").eq("email", email).maybeSingle();
  if (found.error) throw Object.assign(new Error("profile_read_failed"), { cause: found.error });
  let userId = (found.data as { id: string } | null)?.id;
  if (userId) {
    // 這個 Email 有人先在總平台註冊、但還沒確認 Email → 可能是別人搶先佔位。
    // 讓那組密碼失效，真正的 Email 主人用「忘記密碼」設定自己的密碼。
    const au = await sb.auth.admin.getUserById(userId);
    if (au.error) throw Object.assign(new Error("auth_user_read_failed"), { cause: au.error });
    if (au.data.user && !au.data.user.email_confirmed_at && au.data.user.app_metadata?.source !== "agent") {
      const reset = await sb.auth.admin.updateUserById(userId, { password: crypto.randomUUID() + "Aa1", app_metadata: { source: "agent", agent_id: agent.id } });
      if (reset.error) throw Object.assign(new Error("squat_reset_failed"), { cause: reset.error });
      console.warn("[agents] 未確認的平台帳號收到代理站訂單，已讓原密碼失效", userId);
    }
  }
  if (!userId) {
    const created = await sb.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { display_name: m.name.trim().slice(0, 16) },
      app_metadata: { source: "agent", agent_id: agent.id },
    });
    if (created.error || !created.data.user) {
      // 兩筆同時進來：另一筆剛建好 → 再找一次
      const again = await sb.from("profiles").select("id").eq("email", email).maybeSingle();
      const againId = (again.data as { id: string } | null)?.id;
      if (!againId) throw Object.assign(new Error("member_create_failed"), { cause: created.error });
      userId = againId;
      return linkAgentMember(sb, agent, m, userId);
    }
    userId = created.data.user.id;
    // 會員資料由觸發器建立，但那時還沒有來源標記 → 在這裡補上「從哪個代理站來」
    const tag = await sb.from("profiles").update({ source: "agent", source_agent_id: agent.id }).eq("id", userId);
    if (tag.error) console.error("[agents] 會員來源標記失敗（不影響訂單）", userId, tag.error.message);
  }
  return linkAgentMember(sb, agent, m, userId);
}

/** 已經有的「代理站會員 ↔ 總平台會員」對應不覆蓋（避免換個 Email 就把別人的對應改掉） */
async function linkAgentMember(sb: SupabaseClient, agent: AgentRow, m: Body["member"], userId: string): Promise<string> {
  const link = await sb
    .from("agent_members")
    .upsert({ agent_id: agent.id, agent_user_id: m.agentUserId, user_id: userId, name: m.name.trim() }, { onConflict: "agent_id,agent_user_id", ignoreDuplicates: true });
  if (link.error) throw Object.assign(new Error("agent_member_failed"), { cause: link.error });
  const { data: mapped } = await sb.from("agent_members").select("user_id").eq("agent_id", agent.id).eq("agent_user_id", m.agentUserId).maybeSingle();
  if (mapped && mapped.user_id !== userId) console.warn("[agents] 代理站會員的 Email 對到不同的總平台會員，訂單依 Email 記錄，請客服確認", agent.id, m.agentUserId);
  return userId;
}

/** 之前收過同一筆：內容一樣＝重送（回原本的紀錄），不一樣＝衝突 */
async function existing(sb: SupabaseClient, agent: AgentRow, b: Body): Promise<Response | null> {
  const { data, error } = await sb.from("orders").select("order_no, total, currency, game_id").eq("agent_id", agent.id).eq("agent_order_id", b.agentOrderId).maybeSingle();
  if (error) throw Object.assign(new Error("order_read_failed"), { cause: error });
  if (!data) return null;
  const same = data.total === b.amount && data.currency === b.currency && data.game_id === b.gameId;
  if (!same) return bad("conflict", 409);
  return Response.json({ agentOrderId: b.agentOrderId, recordId: data.order_no, duplicate: true });
}

export async function POST(request: Request) {
  const sb = db();
  if (!sb) return bad("not_configured", 503);
  const raw = await request.text();
  try {
    const agent = await authenticateAgent(sb, request.headers, raw);
    if (!agent) return bad("unauthorized", 401);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return bad("bad_json");
    }
    const b = validate(parsed, agent);
    if (typeof b === "string") return bad(b);

    const dup = await existing(sb, agent, b);
    if (dup) return dup;
    const userId = await resolveMember(sb, agent, b.member);
    const recordId = newRecordNo();
    try {
      await insertOrder(
        sb,
        {
          orderNo: recordId,
          channel: "agent",
          userId,
          gameId: b.gameId,
          regionId: agent.region_id,
          currency: b.currency,
          total: b.amount,
          status: "paid",
          provider: b.paymentMethod ?? "agent",
          paidAt: new Date(b.paidAt).toISOString(),
          agentId: agent.id,
          agentOrderId: b.agentOrderId,
          raw: parsed,
        },
        b.items,
      );
    } catch (e) {
      // 兩個相同的請求同時進來：後到的撞到「同一個代理站訂單編號不可重複」→ 當成重送處理
      const dup2 = await existing(sb, agent, b);
      if (dup2) return dup2;
      throw e;
    }
    return Response.json({ agentOrderId: b.agentOrderId, recordId, duplicate: false });
  } catch (e) {
    console.error("[agents] 回報訂單處理失敗", e, (e as { cause?: unknown }).cause);
    return bad("server_error", 500);
  }
}

export async function GET(request: Request) {
  const sb = db();
  if (!sb) return bad("not_configured", 503);
  const url = new URL(request.url);
  try {
    const agent = await authenticateAgent(sb, request.headers, url.pathname + url.search);
    if (!agent) return bad("unauthorized", 401);
    const date = url.searchParams.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return bad("bad_date");
    // 台灣日期的 00:00～隔天 00:00
    const from = new Date(`${date}T00:00:00+08:00`);
    const to = new Date(from.getTime() + 86400_000);
    const { data, error } = await sb
      .from("orders")
      .select("order_no, agent_order_id, game_id, total, currency, status, paid_at, refunded_at, refund_amount")
      .eq("agent_id", agent.id)
      .gte("paid_at", from.toISOString())
      .lt("paid_at", to.toISOString())
      .order("paid_at");
    if (error) throw Object.assign(new Error("order_list_failed"), { cause: error });
    const orders = (data ?? []).map((o) => ({
      agentOrderId: o.agent_order_id,
      recordId: o.order_no,
      gameId: o.game_id,
      amount: o.total,
      currency: o.currency,
      paidAt: o.paid_at,
      refunded: o.status === "refunded",
    }));
    const refunds = (data ?? []).filter((o) => o.status === "refunded").reduce((s, o) => s + (o.refund_amount ?? o.total), 0);
    return Response.json({
      date,
      orders,
      summary: { count: orders.length, amount: orders.reduce((s, o) => s + o.amount, 0), refunds },
    });
  } catch (e) {
    console.error("[agents] 對帳查詢失敗", e, (e as { cause?: unknown }).cause);
    return bad("server_error", 500);
  }
}
