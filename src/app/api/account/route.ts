// 刪除自己的平台帳號（會員中心 →「刪除帳號」，畫面上已再確認一次密碼）。
// 會員資料、遊戲帳號一起刪；訂單保留（對帳、發票要用），只是不再對應到這個人。

import { createClient } from "@supabase/supabase-js";
import { db, userFromRequest } from "@/server/supabase";
import { rateLimiter } from "@/server/guard";

/** 每個帳號 10 分鐘最多 5 次（防止用來猜密碼；用帳號計次，IP 標頭可以偽造） */
const limit = rateLimiter(5, 10 * 60_000);

/** 伺服器自己用密碼登入一次確認（不只信任畫面上的檢查；拿到登入憑證也刪不了別人的帳號） */
async function passwordOk(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return false;
  const c = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  return !error;
}

export async function DELETE(request: Request) {
  const sb = db();
  if (!sb) return Response.json({ error: "not_configured" }, { status: 503 });
  const user = await userFromRequest(request);
  if (!user?.email) return Response.json({ error: "login_required" }, { status: 401 });
  if (!limit(request, Date.now(), user.id)) return Response.json({ error: "too_many_attempts" }, { status: 429 });
  const password = ((await request.json().catch(() => ({}))) as { password?: unknown }).password;
  if (typeof password !== "string" || !(await passwordOk(user.email, password))) return Response.json({ error: "bad_credentials" }, { status: 403 });
  const { error } = await sb.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account] 刪除帳號失敗", user.id, error.message);
    return Response.json({ error: "failed" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
