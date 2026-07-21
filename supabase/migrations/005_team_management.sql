-- ============================================================
-- KRYPTA: Enterprise Team Management
-- Teams, members, invitations, and role-based access control
-- ============================================================

-- Enable required extensions
create extension if not exists pgcrypto;

-- 1. Drop existing tables (if any) - using DO blocks for safety
-- ============================================================
DO $$ BEGIN
  DROP TABLE IF EXISTS public.team_invitations CASCADE;
END $$;

DO $$ BEGIN
  DROP TABLE IF EXISTS public.team_members CASCADE;
END $$;

DO $$ BEGIN
  DROP TABLE IF EXISTS public.teams CASCADE;
END $$;

-- 2. Create all tables
-- ============================================================

-- Teams (Organizations)
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  avatar_url text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Team Members
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'developer', 'viewer')),
  joined_at timestamptz not null default now(),
  unique(team_id, user_id)
);

-- Team Invitations
create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'developer', 'viewer')),
  invited_by uuid not null references auth.users(id),
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- 3. Enable RLS on all tables
-- ============================================================
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invitations enable row level security;

-- 4. Create policies for teams
-- ============================================================
create policy "Team members can view team" on public.teams
  for select using (
    exists (
      select 1 from public.team_members
      where team_id = teams.id and user_id = auth.uid()
    )
  );

create policy "Team owners can update team" on public.teams
  for update using (
    exists (
      select 1 from public.team_members
      where team_id = teams.id and user_id = auth.uid() and role = 'owner'
    )
  );

-- 5. Create policies for team_members
-- ============================================================
create policy "Team members can view members" on public.team_members
  for select using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = team_members.team_id and tm.user_id = auth.uid()
    )
  );

create policy "Team owners/admins can manage members" on public.team_members
  for all using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = team_members.team_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
    )
  );

-- 6. Create policies for team_invitations
-- ============================================================
create policy "Team members can view invitations" on public.team_invitations
  for select using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = team_invitations.team_id and tm.user_id = auth.uid()
    )
  );

create policy "Team owners/admins can manage invitations" on public.team_invitations
  for all using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = team_invitations.team_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
    )
  );

-- 7. Add team_id to repositories
-- ============================================================
DO $$ BEGIN
  alter table public.repositories add column if not exists team_id uuid references public.teams(id) on delete cascade;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  alter table public.repositories add column if not exists user_id_owner uuid references auth.users(id) on delete cascade;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Update RLS for repositories with team support
DO $$ BEGIN
  create policy "Team members can view team repos" on public.repositories
    for select using (
      team_id is not null and exists (
        select 1 from public.team_members tm
        where tm.team_id = repositories.team_id and tm.user_id = auth.uid()
      )
      or exists (
        select 1 from public.repositories r
        where r.id = repositories.id and r.user_id = auth.uid()
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 8. Enable realtime
-- ============================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.team_invitations;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 9. Trigger for updated_at
-- ============================================================
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

DO $$ BEGIN
  create trigger update_teams_updated_at
    before update on public.teams
    for each row execute procedure public.update_updated_at_column();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 10. Add default_team_id to profiles
-- ============================================================
DO $$ BEGIN
  alter table public.profiles add column if not exists default_team_id uuid references public.teams(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
