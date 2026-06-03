-- ============================================================
-- 0004: 刷題點數上限 + 錯字間隔複習
-- 在 Supabase Dashboard > SQL Editor 執行(在 0003 之後)
-- ============================================================

-- 每個 (學生, 單字表) 從測驗滿分累計的點數上限(由後端控制最多 2)
create table if not exists public.week_points (
  user_id uuid not null references public.app_users(id) on delete cascade,
  week_id uuid not null references public.weeks(id) on delete cascade,
  points int not null default 0,
  primary key (user_id, week_id)
);

alter table public.week_points enable row level security;
-- 無 policy => 僅 service_role 可存取

-- 錯字最後複習日期(台北日期)，用於「每天一次」與畢業判定
alter table public.student_mistakes
  add column if not exists last_reviewed date;
