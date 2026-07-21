-- ============================================================
-- KRYPTA: Repository Scanning Rules
-- Allows per-repo custom scanning configuration
-- ============================================================

create table if not exists public.repository_settings (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.repositories(id) on delete cascade unique,
  
  -- Minimum severity to report (Low/Medium/High/Critical)
  -- Anything below this threshold is filtered out
  min_severity text not null default 'Low',
  
  -- File path patterns to include in scanning (empty = all)
  include_paths text[] not null default '{}',
  
  -- File path patterns to exclude from scanning
  exclude_paths text[] not null default array['node_modules/', '.next/', 'dist/', 'build/', 'vendor/', 'test/', 'tests/', '__tests__', '.spec.', '.test.', 'cypress/', 'playwright/'],
  
  -- Enable automatic AI vulnerability scanning
  enable_ai_scan boolean not null default true,
  
  -- Automatically create PRs for fixes
  enable_auto_pr boolean not null default true,
  
  -- Scan only changed files (true = diff-only, false = full repo scan)
  scan_only_changes boolean not null default true,
  
  -- Vulnerability types to ignore (e.g., array of "XSS", "SQL Injection")
  ignored_types text[] not null default '{}',
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.repository_settings enable row level security;

create policy "Users can view own repo settings" on public.repository_settings
  for select using (
    exists (
      select 1 from public.repositories r
      where r.id = repository_settings.repository_id and r.user_id = auth.uid()
    )
  );

create policy "Users can update own repo settings" on public.repository_settings
  for update using (
    exists (
      select 1 from public.repositories r
      where r.id = repository_settings.repository_id and r.user_id = auth.uid()
    )
  );

create policy "Users can insert own repo settings" on public.repository_settings
  for insert with check (
    exists (
      select 1 from public.repositories r
      where r.id = repository_settings.repository_id and r.user_id = auth.uid()
    )
  );

create policy "Service role can manage repo settings" on public.repository_settings
  for all using (true);

-- Trigger to update updated_at
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_repository_settings_updated_at
  before update on public.repository_settings
  for each row execute procedure public.update_updated_at_column();

-- Enable realtime
alter publication supabase_realtime add table public.repository_settings;
