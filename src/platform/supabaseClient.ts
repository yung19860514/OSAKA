// 瀏覽器端的 Supabase 連線（只用公開的 anon 金鑰；能讀什麼由資料庫的 RLS 規則決定）。
// 重設密碼／確認信的連結：Supabase 後台「Redirect URLs」只能列確切網址（不可用 * 萬用），
// 否則連結可能被導到別的網站（不用 PKCE：玩家常在電腦申請、手機開信，PKCE 要同一個瀏覽器）。

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

/** 有沒有設定雲端會員系統 */
export const cloudConfigured = !!(url && anon);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!cloudConfigured) throw new Error("supabase_not_configured");
  client ??= createClient(url!, anon!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "playhub.auth" },
  });
  return client;
}

/** 呼叫平台 API 時帶上的登入憑證（沒登入＝空物件） */
export async function authHeaders(): Promise<Record<string, string>> {
  if (!cloudConfigured) return {};
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}
