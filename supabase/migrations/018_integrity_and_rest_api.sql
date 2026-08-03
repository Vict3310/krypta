-- ============================================================
-- KRYPTA: Integrity monitor RPC + missing REST API tables
--
-- 1. check_security_integrity() — verifies RLS is enabled and key
--    policies exist on the core tables. The security-integrity cron
--    calls this; if it errors, the monitor records an integrity
--    failure and disables the exploit engine. Defining it here
--    prevents that false-positive self-destruct.
--
-- 2. Tables referenced by the v1 REST API that were never created:
--    scan_results, compliance_reports, vulnerability_database,
--    vulnerability_checks.
-- ============================================================

-- 1. Integrity check RPC
create or replace function public.check_security_integrity()
returns table (
  table_name text,
  rls_enabled boolean,
  policy_count bigint
)
language plpgsql security definer set search_path = public as $$
begin
  return query
  select
    c.relname::text as table_name,
    c.relrowsecurity as rls_enabled,
    count(p.policyname)::bigint as policy_count
  from pg_class c
  left join pg_policy p on p.polrelid = c.oid
  where c.relkind = 'r'
    and c.relnamespace = 'public'::regnamespace
    and c.relname in (
      'profiles', 'repositories', 'scans', 'vulnerabilities',
      'repository_settings', 'teams', 'team_members', 'team_invitations',
      'exploit_scan_jobs', 'exploit_results', 'api_keys',
      'security_events', 'security_actions', 'security_settings',
      'scan_authorizations', 'sso_configurations', 'invoices'
    )
  group by c.relname, c.relrowsecurity
  order by c.relname;
end;
$$;

revoke execute on function public.check_security_integrity() from anon, authenticated;
grant execute on function public.check_security_integrity() to service_role;

-- 2. scan_results — per-scan result summary (used by v1/scans + v1/vulnerabilities)
create table if not exists public.scan_results (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  total_vulnerabilities integer not null default 0,
  critical integer not null default 0,
  high integer not null default 0,
  medium integer not null default 0,
  low integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.scan_results enable row level security;
create policy "Users can view own scan results" on public.scan_results
  for select using (
    exists (
      select 1 from public.scans s
      join public.repositories r on r.id = s.repository_id
      where s.id = scan_results.scan_id and r.user_id = auth.uid()
    )
  );
create policy "Service role can manage scan results" on public.scan_results
  for all using (true) with check (true);

-- 3. compliance_reports — generated compliance report storage (v1/compliance)
create table if not exists public.compliance_reports (
  id uuid primary key default gen_random_uuid(),
  team_id text not null default 'owner',
  report_type text not null,
  format text not null default 'json',
  date_range text,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  generated_at timestamptz not null default now()
);
alter table public.compliance_reports enable row level security;
create policy "Admins can view compliance reports" on public.compliance_reports
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );
create policy "Service role can manage compliance reports" on public.compliance_reports
  for all using (true) with check (true);

-- 4. vulnerability_database — private known-vulnerability database (v1/vulns/database)
create table if not exists public.vulnerability_database (
  id uuid primary key default gen_random_uuid(),
  cve_id text,
  title text not null,
  description text,
  severity text not null check (severity in ('low','medium','high','critical')),
  category text not null,
  affected_versions jsonb not null default '[]'::jsonb,
  patch_level text,
  references jsonb not null default '[]'::jsonb,
  affected_files jsonb not null default '[]'::jsonb,
  is_internal boolean not null default true,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);
alter table public.vulnerability_database enable row level security;
create policy "Admins can view vulnerability database" on public.vulnerability_database
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );
create policy "Service role can manage vulnerability database" on public.vulnerability_database
  for all using (true) with check (true);

-- 5. vulnerability_checks — record of DB-vuln vs repo checks (v1/vulns/database/[id]/check)
create table if not exists public.vulnerability_checks (
  id uuid primary key default gen_random_uuid(),
  vulnerability_id uuid not null references public.vulnerability_database(id) on delete cascade,
  repository text not null,
  branch text not null default 'main',
  file text,
  status text not null default 'not_found',
  checked_at timestamptz not null default now()
);
alter table public.vulnerability_checks enable row level security;
create policy "Admins can view vulnerability checks" on public.vulnerability_checks
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );
create policy "Service role can manage vulnerability checks" on public.vulnerability_checks
  for all using (true) with check (true);
