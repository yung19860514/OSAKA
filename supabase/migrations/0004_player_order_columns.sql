-- ============================================================
-- 遊樂平台資料庫 v4：玩家只能讀訂單的一般欄位
-- 執行方式：Supabase → SQL Editor → 整段貼上 → Run（在 v3 之後執行，只要一次）
-- 客服備註、代理站原始資料、金流內部欄位只有後台與網站伺服器看得到。
-- ============================================================

begin;

revoke select on public.orders from authenticated;
grant select (
  id, order_no, channel, user_id, game_id, region_id, currency, total, status,
  payment_code, payment_url, expires_at, paid_at, delivered_at, refunded_at, created_at
) on public.orders to authenticated;

commit;
