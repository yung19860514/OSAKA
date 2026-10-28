-- ============================================================
-- 遊樂平台資料庫 v5：玩家道具存在伺服器
-- 執行方式：Supabase → SQL Editor → 整段貼上 → Run（只要執行一次）
-- 每個會員在每款遊戲一筆：擁有的造型、道具數量、每日禮物領取日。
-- 玩家只能讀自己的；加減道具一律由網站伺服器處理（付款到帳、使用道具、領每日禮物）。
-- ============================================================

begin;

create table public.player_wallets (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null,
  data jsonb not null,
  -- 每次修改 +1：兩個請求同時改時，後到的會發現版本變了而重試（不會互相蓋掉）
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create trigger player_wallets_updated_at before update on public.player_wallets
  for each row execute function public.set_updated_at();

alter table public.player_wallets enable row level security;
create policy "會員讀自己的道具" on public.player_wallets
  for select to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.player_wallets to service_role;
grant select on public.player_wallets to authenticated;

commit;
