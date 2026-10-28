-- ============================================================
-- 遊樂平台資料庫 v2：開放權限 ＋ Email 變更同步
-- 執行方式：Supabase → SQL Editor → 整段貼上 → Run（只要執行一次）
-- 新版 Supabase 不會自動把資料表開放給 API 角色，要明確授權：
--   service_role（網站伺服器）：全部讀寫
--   authenticated（登入的玩家）：只能讀，而且 RLS 規則限制只看得到自己的
--   anon（未登入）：完全不開放
-- ============================================================

begin;

grant usage on schema public to service_role, authenticated;

grant select, insert, update, delete on
  public.profiles, public.agents, public.agent_members, public.game_accounts,
  public.orders, public.order_items, public.payment_events
  to service_role;
grant select on public.daily_revenue to service_role;
grant usage, select on all sequences in schema public to service_role;

grant select on public.profiles, public.game_accounts, public.orders, public.order_items to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- 登入帳號的 Email 改了（而且已確認）→ 會員資料跟著改
create function public.handle_user_email_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.handle_user_email_change();

commit;
