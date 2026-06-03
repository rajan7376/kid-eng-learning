-- ============================================================
-- 0005: 動物照顧(餵食/打掃/離家)
-- 在 Supabase Dashboard > SQL Editor 執行(在 0004 之後)
-- ============================================================

-- care 存放餵食/清潔狀態與道具庫存(由後端維護)
-- { last_fed, last_cleaned, feed, broom, lastFeedEarned, lastBroomEarned }
alter table public.student_progress
  add column if not exists care jsonb not null default '{}'::jsonb;
