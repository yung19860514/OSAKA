// 其他儲值管道（代理站）呼叫總平台 API 的身分驗證。規格：docs/代理儲值串接規格.md 第 5 章。
//   X-Agent-Id: <agentId>
//   X-Agent-Timestamp: <Unix 秒數>（跟總平台時間差超過 5 分鐘就拒絕，防重放）
//   X-Agent-Signature: v1=<HMAC-SHA256(代理金鑰, 時間戳 + "." + 簽章內容)>
//     POST：簽章內容＝原始 body；GET：簽章內容＝網址路徑＋參數（例 /api/v1/agents/orders?date=2026-10-23）
// 代理金鑰放環境變數 AGENT_SECRET_<代號大寫>（例 AGENT_SECRET_AGENT_HK），不放資料庫。

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AgentRow {
  id: string;
  name: string;
  region_id: string;
  currency: string;
  active: boolean;
}

export const AGENT_ID = /^[a-z0-9_]{2,32}$/;
const MAX_SKEW_SEC = 300;

export function agentSecret(agentId: string, env: Record<string, string | undefined> = process.env): string | null {
  return env[`AGENT_SECRET_${agentId.toUpperCase()}`]?.trim() || null;
}

export function sign(secret: string, timestamp: string, content: string): string {
  return "v1=" + createHmac("sha256", secret).update(`${timestamp}.${content}`).digest("hex");
}

/** 檢查簽章與時間；對了回 agentId，不對回 null */
export function verifySignature(headers: Headers, content: string, now = Date.now(), env: Record<string, string | undefined> = process.env): string | null {
  const agentId = headers.get("x-agent-id") ?? "";
  const ts = headers.get("x-agent-timestamp") ?? "";
  const sig = headers.get("x-agent-signature") ?? "";
  if (!AGENT_ID.test(agentId) || !/^\d{9,11}$/.test(ts) || !/^v1=[0-9a-f]{64}$/.test(sig)) return null;
  if (Math.abs(now / 1000 - Number(ts)) > MAX_SKEW_SEC) return null;
  const secret = agentSecret(agentId, env);
  if (!secret) return null;
  const expect = sign(secret, ts, content);
  return timingSafeEqual(Buffer.from(expect), Buffer.from(sig)) ? agentId : null;
}

/** 驗證後再確認代理站在資料庫裡、而且啟用中 */
export async function authenticateAgent(sb: SupabaseClient, headers: Headers, content: string): Promise<AgentRow | null> {
  const id = verifySignature(headers, content);
  if (!id) return null;
  const { data, error } = await sb.from("agents").select("id, name, region_id, currency, active").eq("id", id).maybeSingle();
  if (error) throw Object.assign(new Error("agent_read_failed"), { cause: error });
  const agent = data as AgentRow | null;
  return agent?.active ? agent : null;
}
