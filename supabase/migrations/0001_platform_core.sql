-- ============================================================
-- 遊樂平台（總平台）資料庫 v1：會員、遊戲帳號、訂單、對帳
-- 執行方式：Supabase → SQL Editor → 整段貼上 → Run（只要執行一次）
-- 寫入一律由網站伺服器（service_role）處理；玩家只能讀自己的資料。
-- ============================================================

begin;

-- ---------- 會員（每個登入帳號一筆，跟 Supabase 登入帳號 auth.users 一對一） ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  -- 帳號綁定的地區（決定幣別、售價、代理）
  region_id text not null default 'tw',
  -- 從哪裡來：platform＝在總平台註冊；agent＝其他儲值管道回報訂單時自動建立
  source text not null default 'platform' check (source in ('platform', 'agent')),
  source_agent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));

-- ---------- 其他儲值管道（代理站） ----------
-- 簽章金鑰不放資料庫，放網站伺服器的環境變數
create table public.agents (
  id text primary key check (id ~ '^[a-z0-9_]{2,32}$'),
  name text not null,
  region_id text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 代理站的會員編號 ↔ 總平台會員（對帳、客服用）
create table public.agent_members (
  agent_id text not null references public.agents (id),
  agent_user_id text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text,
  created_at timestamptz not null default now(),
  primary key (agent_id, agent_user_id)
);
create index agent_members_user_id_idx on public.agent_members (user_id);

-- ---------- 遊戲帳號（一個會員在每款遊戲各一個） ----------
create table public.game_accounts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null,
  -- 遊戲方自己的帳號編號（遊戲接上單一登入後回填）
  game_account_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- ---------- 訂單（總平台自己賣的 + 其他管道回報的，全部記在這裡＝對帳的最終紀錄） ----------
create table public.orders (
  id bigint generated always as identity primary key,
  -- 對外的訂單編號：總平台＝黑貓 PAY 訂單號；其他管道＝總平台配發的紀錄編號
  order_no text not null unique,
  channel text not null check (channel in ('platform', 'agent')),
  agent_id text references public.agents (id),
  agent_order_id text,
  user_id uuid references public.profiles (id) on delete set null,
  game_id text not null,
  region_id text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- 金額一律整數（該幣別的整數金額）
  total integer not null check (total > 0),
  -- pending 待繳費 → paid 已付款 → delivered 已發貨；expired 逾期、cancelled 註銷、
  -- refunded 已退款、review 金額不符要人工對帳
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'delivered', 'expired', 'cancelled', 'refunded', 'review')),
  payment_provider text,
  -- 超商繳費代碼、條碼網址
  payment_code text,
  payment_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  paid_amount integer,
  delivered_at timestamptz,
  refunded_at timestamptz,
  refund_amount integer,
  -- 其他管道送來的原始內容（對帳查證用）
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 其他管道的訂單一定要有代理站與它的訂單編號，而且同一個代理站內不重複（重送不會重複記錄）
  constraint orders_agent_fields check (
    (channel = 'agent' and agent_id is not null and agent_order_id is not null)
    or (channel = 'platform' and agent_id is null and agent_order_id is null)
  ),
  constraint orders_agent_order_key unique (agent_id, agent_order_id)
);
create index orders_user_id_created_idx on public.orders (user_id, created_at desc);
create index orders_created_idx on public.orders (created_at);
create index orders_agent_created_idx on public.orders (agent_id, created_at) where agent_id is not null;
create index orders_pending_idx on public.orders (expires_at) where status = 'pending';

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  sku text not null,
  name text,
  qty integer not null check (qty > 0),
  unit_price integer not null check (unit_price >= 0)
);
create index order_items_order_id_idx on public.order_items (order_id);

-- ---------- 金流通知與 API 呼叫紀錄（出問題時查證用） ----------
create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  order_no text,
  event text not null,
  payload jsonb,
  result text,
  created_at timestamptz not null default now()
);
create index payment_events_order_no_idx on public.payment_events (order_no);

-- ---------- 每日營收（依台灣日期 × 管道 × 代理站 × 遊戲 × 地區 × 幣別） ----------
create view public.daily_revenue with (security_invoker = true) as
select
  (o.created_at at time zone 'Asia/Taipei')::date as day,
  o.channel,
  o.agent_id,
  o.game_id,
  o.region_id,
  o.currency,
  count(*) filter (where o.status in ('paid', 'delivered', 'refunded')) as orders,
  coalesce(sum(o.total) filter (where o.status in ('paid', 'delivered', 'refunded')), 0) as gross,
  coalesce(sum(coalesce(o.refund_amount, o.total)) filter (where o.status = 'refunded'), 0) as refunds,
  coalesce(sum(o.total) filter (where o.status in ('paid', 'delivered')), 0) as net
from public.orders o
group by 1, 2, 3, 4, 5, 6;

-- ---------- 自動更新 updated_at ----------
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------- 新註冊的登入帳號自動建立會員資料 ----------
create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, source, source_agent_id)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'display_name',
    coalesce(new.raw_app_meta_data ->> 'source', 'platform'),
    new.raw_app_meta_data ->> 'agent_id'
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 權限：全部開 RLS；玩家只能讀自己的資料，寫入一律走伺服器 ----------
alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.agent_members enable row level security;
alter table public.game_accounts enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_events enable row level security;

create policy "會員讀自己的資料" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
-- 只允許改暱稱（其他欄位由伺服器維護）
create policy "會員改自己的暱稱" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy "會員讀自己的遊戲帳號" on public.game_accounts
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "會員讀自己的訂單" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "會員讀自己訂單的內容" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

-- agents、agent_members、payment_events 沒有開放給玩家的規則＝只有伺服器讀寫得到
-- 營收報表只給伺服器
revoke all on public.daily_revenue from anon, authenticated;
-- 玩家端完全不能寫入、刪除
revoke insert, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on public.payment_events, public.agents, public.agent_members from anon;

commit;
