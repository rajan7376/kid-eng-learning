-- ============================================================
-- 兒童美語互動單字本 - 初始 schema
-- 在 Supabase Dashboard > SQL Editor 執行此檔
-- ============================================================

-- ---------- Tables ----------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  code text not null,                 -- 3A / 4A
  name text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, code)
);

create table if not exists public.weeks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  week_label text not null,           -- W17
  date_range text,                    -- 06/01-06/05
  sort_order int,
  created_at timestamptz not null default now(),
  unique (class_id, week_label)
);

create table if not exists public.word_cards (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks(id) on delete cascade,
  sort_order int,
  english_word text not null,
  part_of_speech text,
  word_meaning_zh text,
  sentence text,
  sentence_zh text,
  audio_word_normal text,
  audio_word_slow text,
  audio_sentence_normal text,
  audio_sentence_slow text,
  created_at timestamptz not null default now()
);

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  week_id uuid references public.weeks(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  file_path text not null,
  mime_type text not null,
  status text not null default 'pending',  -- pending|processing|done|error
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_weeks_class on public.weeks(class_id);
create index if not exists idx_cards_week on public.word_cards(week_id);
create index if not exists idx_uploads_owner on public.uploads(owner_id);

-- ---------- RLS ----------
alter table public.classes enable row level security;
alter table public.weeks enable row level security;
alter table public.word_cards enable row level security;
alter table public.uploads enable row level security;

-- 前台(孩子)無需登入即可瀏覽 -> 公開讀取卡片/班級/週次
drop policy if exists "public read classes" on public.classes;
create policy "public read classes" on public.classes
  for select using (true);

drop policy if exists "public read weeks" on public.weeks;
create policy "public read weeks" on public.weeks
  for select using (true);

drop policy if exists "public read cards" on public.word_cards;
create policy "public read cards" on public.word_cards
  for select using (true);

-- 寫入僅限擁有者(家長)
drop policy if exists "owner write classes" on public.classes;
create policy "owner write classes" on public.classes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owner write weeks" on public.weeks;
create policy "owner write weeks" on public.weeks
  for all using (
    exists (select 1 from public.classes c where c.id = weeks.class_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.classes c where c.id = weeks.class_id and c.owner_id = auth.uid())
  );

drop policy if exists "owner write cards" on public.word_cards;
create policy "owner write cards" on public.word_cards
  for all using (
    exists (
      select 1 from public.weeks w
      join public.classes c on c.id = w.class_id
      where w.id = word_cards.week_id and c.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.weeks w
      join public.classes c on c.id = w.class_id
      where w.id = word_cards.week_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "owner all uploads" on public.uploads;
create policy "owner all uploads" on public.uploads
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------- Storage buckets ----------
-- handouts: 私有原始講義；audio: 公開語音快取
insert into storage.buckets (id, name, public)
values ('handouts', 'handouts', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do nothing;

-- audio bucket 公開讀
drop policy if exists "public read audio" on storage.objects;
create policy "public read audio" on storage.objects
  for select using (bucket_id = 'audio');
