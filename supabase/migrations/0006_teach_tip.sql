-- ============================================================
-- 0006: 單字記憶教學(AI 生成，快取於卡片)
-- 在 Supabase Dashboard > SQL Editor 執行(在 0005 之後)
-- ============================================================

-- teach_tip 存 AI 產生的記憶小技巧(JSON)，避免每次重打 Gemini
alter table public.word_cards
  add column if not exists teach_tip jsonb;
