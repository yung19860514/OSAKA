-- ============================================================
-- 遊樂平台資料庫 v3：客服待處理清單
-- 執行方式：Supabase → SQL Editor → 整段貼上 → Run（只要執行一次）
--
-- 客服怎麼用：
--   1. Supabase 左邊「Table Editor」→ 選 support_queue → 看到所有要處理的訂單
--   2. 處理完到 orders 表找到那筆訂單（用訂單編號 order_no 搜尋），修改：
--        退款：status 改 refunded、refund_amount 填退多少、refunded_at 填退款時間
--        補發：在遊戲裡補給玩家後不用改 status
--        不論哪種，最後都要：support_note 寫處理經過（例：已轉帳 2026/11/01 國泰 末五碼 12345）、
--                           support_closed_at 填處理完成的時間
--   3. 填了 support_closed_at 的訂單會自動從 support_queue 消失
-- ============================================================

begin;

-- 客服備註（處理經過，對帳時看得到）
alter table public.orders add column support_note text;
-- 客服標記「已處理」的時間（玩家回報發貨失敗、但查證後不用處理時填這個）
alter table public.orders add column support_closed_at timestamptz;

create view public.support_queue with (security_invoker = true) as
select
  o.order_no as "訂單編號",
  case
    when o.status = 'review' then '金額不符／已註銷卻收到繳費，要對帳'
    when o.status = 'delivered' then '玩家回報沒收到道具'
    else o.status
  end as "原因",
  o.status as "目前狀態",
  o.game_id as "遊戲",
  o.channel as "管道",
  o.agent_id as "代理站",
  o.total as "訂單金額",
  o.paid_amount as "實收金額",
  o.currency as "幣別",
  p.email as "會員email",
  p.display_name as "會員暱稱",
  o.paid_at as "付款時間",
  o.created_at as "建立時間",
  o.support_note as "客服備註"
from public.orders o
left join public.profiles p on p.id = o.user_id
where o.support_closed_at is null
  and (
    o.status = 'review'
    or (
      o.status = 'delivered'
      and exists (
        select 1 from public.payment_events e
        where e.order_no = o.order_no and e.event = 'delivery_failed_reported'
      )
    )
  )
order by o.created_at;

-- 只有後台（與網站伺服器）看得到，玩家看不到
revoke all on public.support_queue from anon, authenticated;
grant select on public.support_queue to service_role;

commit;
