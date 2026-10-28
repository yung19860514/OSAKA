// 伺服器端的 Supabase 連線（最高權限 service_role：只能在伺服器用，絕不能進瀏覽器）。
// 環境變數：NEXT_PUBLIC_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY（Vercel 與本機 .env.local）。

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

let admin: SupabaseClient | null | undefined;

/** 資料庫連線；沒設定＝回 null（本機沒填金鑰時沿用舊的開發替身流程） */
export function db(): SupabaseClient | null {
  if (admin !== undefined) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  admin = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return admin;
}

/** 從請求的「Authorization: Bearer <登入憑證>」找出登入中的會員；沒登入或憑證無效＝null */
export async function userFromRequest(request: Request): Promise<User | null> {
  const sb = db();
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!sb || !token) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  // Email 沒確認的帳號一律當作沒登入（防止先拿別人的 Email 註冊來佔位）
  if (!data.user.email_confirmed_at) return null;
  return data.user;
}

/** 記一筆金流／API 事件（出問題時查證用；寫失敗不影響主流程，但要留 log） */
export async function logPaymentEvent(e: { provider: string; orderNo?: string; event: string; payload?: unknown; result?: string }) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb.from("payment_events").insert({
    provider: e.provider,
    order_no: e.orderNo ?? null,
    event: e.event,
    payload: e.payload ?? null,
    result: e.result ?? null,
  });
  if (error) console.error("[db] 金流事件寫入失敗", e.event, e.orderNo, error.message);
}
