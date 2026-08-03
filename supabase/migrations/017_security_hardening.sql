-- ============================================================
-- KRYPTA: Security hardening
-- 1. Restrict get_user_by_email to the service role only (prevents
--    user enumeration + PII disclosure via the public API).
-- 2. Ensure sso_configurations exists with RLS + admin-only policies
--    (the SSO endpoints manage a global setting; any previously
--    manually-created table may have had no RLS at all).
-- ============================================================

-- 1. get_user_by_email — revoke from anon/authenticated.
revoke execute on function public.get_user_by_email(text) from anon;
revoke execute on function public.get_user_by_email(text) from authenticated;
grant execute on function public.get_user_by_email(text) to service_role;

-- 2. sso_configurations — global enterprise SSO settings.
create table if not exists public.sso_configurations (
  id uuid primary key default gen_random_uuid(),
  team_id text not null default 'owner' unique,
  provider text,
  sso_url text,
  certificate_data jsonb,
  provider_config jsonb default '{}'::jsonb,
  callback_url text,
  enforced boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sso_configurations enable row level security;

drop policy if exists "Admins can manage sso configurations" on public.sso_configurations;
create policy "Admins can manage sso configurations" on public.sso_configurations
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

drop policy if exists "Service role can manage sso configurations" on public.sso_configurations;
create policy "Service role can manage sso configurations" on public.sso_configurations
  for all to service_role using (true) with check (true);
