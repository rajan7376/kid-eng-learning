-- ============================================================
-- 0002: 自建帳密驗證 + 學生進度
-- 在 Supabase Dashboard > SQL Editor 執行(在 0001 之後)
-- ============================================================

-- ---------- 帳號(自建驗證) ----------
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  role text not null default 'student',     -- 'admin' | 'student'
  display_name text,
  created_at timestamptz not null default now()
);

-- ---------- 防爆破鎖定(依帳號與 IP) ----------
create table if not exists public.login_guards (
  scope text not null,                       -- 'user' | 'ip'
  key text not null,
  fail_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (scope, key)
);

-- ---------- 學生進度 ----------
create table if not exists public.student_progress (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  points int not null default 0,
  unlocked_count int not null default 0,
  zoo_positions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.student_mistakes (
  user_id uuid not null references public.app_users(id) on delete cascade,
  card_id uuid not null references public.word_cards(id) on delete cascade,
  english_word text not null,
  word_meaning_zh text,
  sentence text,
  sentence_zh text,
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  week_id uuid references public.weeks(id) on delete set null,
  kind text not null default 'quiz',         -- 'quiz' | 'boss'
  score int not null,
  total int not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_mistakes_user on public.student_mistakes(user_id);
create index if not exists idx_results_user on public.test_results(user_id);

-- ---------- RLS：全部鎖死，只有 service_role 能存取 ----------
alter table public.app_users enable row level security;
alter table public.login_guards enable row level security;
alter table public.student_progress enable row level security;
alter table public.student_mistakes enable row level security;
alter table public.test_results enable row level security;
-- 不建立任何 policy => 匿名/一般使用者無法存取；後端用 service_role 繞過

-- ---------- 鬆綁舊的 owner 綁定(改由管理員集中管理) ----------
alter table public.classes drop constraint if exists classes_owner_id_fkey;
alter table public.classes alter column owner_id drop not null;
alter table public.classes drop constraint if exists classes_owner_id_code_key;
do $$
begin
  alter table public.classes add constraint classes_code_key unique (code);
exception when others then null;
end $$;

alter table public.uploads drop constraint if exists uploads_owner_id_fkey;
alter table public.uploads alter column owner_id drop not null;
