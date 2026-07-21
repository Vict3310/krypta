-- ============================================================
-- KRYPTA: Full Database Schema + Row Level Security
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Profiles (extends Supabase Auth users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  avatar_url text,
  plan text not null default 'free', -- 'free' | 'pro'
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. Repositories
create table if not exists public.repositories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  github_repo_id bigint unique,
  full_name text not null,
  is_active boolean not null default true,
  webhook_id bigint,
  default_branch text not null default 'main',
  created_at timestamptz not null default now()
);
alter table public.repositories enable row level security;
create policy "Users can manage own repositories" on public.repositories
  for all using (auth.uid() = user_id);


-- 3. Scans
create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.repositories(id) on delete cascade,
  commit_sha text,
  branch text,
  status text not null default 'pending', -- 'pending' | 'scanning' | 'clean' | 'vulnerable' | 'fixed'
  triggered_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.scans enable row level security;
create policy "Users can view own scans" on public.scans for select
  using (
    exists (
      select 1 from public.repositories r
      where r.id = scans.repository_id and r.user_id = auth.uid()
    )
  );
create policy "Service role can insert scans" on public.scans for insert
  with check (true); -- Relaxed for webhook server actions


-- 4. Vulnerabilities
create table if not exists public.vulnerabilities (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  file_path text,
  vulnerability_type text,
  severity text not null default 'Medium', -- 'Low' | 'Medium' | 'High' | 'Critical'
  plain_english_explanation text,
  vulnerable_code text,
  fixed_code text,
  pr_url text,
  status text not null default 'open', -- 'open' | 'fixed' | 'dismissed' | 'snoozed'
  snoozed_until timestamptz,
  created_at timestamptz not null default now()
);
alter table public.vulnerabilities enable row level security;
create policy "Users can view own vulnerabilities" on public.vulnerabilities for select
  using (
    exists (
      select 1 from public.scans s
      join public.repositories r on r.id = s.repository_id
      where s.id = vulnerabilities.scan_id and r.user_id = auth.uid()
    )
  );
create policy "Users can update own vulnerabilities" on public.vulnerabilities for update
  using (
    exists (
      select 1 from public.scans s
      join public.repositories r on r.id = s.repository_id
      where s.id = vulnerabilities.scan_id and r.user_id = auth.uid()
    )
  );
create policy "Service role can insert vulnerabilities" on public.vulnerabilities for insert
  with check (true);


-- 5. Enable Realtime on scans (for live terminal)
alter publication supabase_realtime add table public.scans;
alter publication supabase_realtime add table public.vulnerabilities;
