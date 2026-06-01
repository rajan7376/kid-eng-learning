-- ============================================================
-- 0003: 動物園社群(送鑽 + 留言)
-- 在 Supabase Dashboard > SQL Editor 執行(在 0002 之後)
-- ============================================================

-- 送鑽石(每人對每個動物園只能送一顆，可收回)
create table if not exists public.zoo_diamonds (
  owner_id uuid not null references public.app_users(id) on delete cascade,
  liker_id uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, liker_id)
);

-- 留言
create table if not exists public.zoo_comments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.app_users(id) on delete cascade,
  author_id uuid not null references public.app_users(id) on delete cascade,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_diamonds_owner on public.zoo_diamonds(owner_id);
create index if not exists idx_comments_owner on public.zoo_comments(owner_id);

alter table public.zoo_diamonds enable row level security;
alter table public.zoo_comments enable row level security;
-- 無 policy => 僅 service_role 可存取(後端 API 控管)
