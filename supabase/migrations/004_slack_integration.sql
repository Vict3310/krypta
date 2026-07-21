-- ============================================================
-- KRYPTA: Slack Integration
-- Stores Slack webhook URLs per user for notifications
-- ============================================================

-- Add slack_webhook_url to profiles table
do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'slack_webhook_url') then
    alter table public.profiles add column slack_webhook_url text;
  end if;
end $$;

-- Store Slack channel name for display purposes
do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'slack_channel_name') then
    alter table public.profiles add column slack_channel_name text default '#security';
  end if;
end $$;

-- Update RLS policy to allow users to update their own slack settings
create policy "Users can update own slack settings" on public.profiles
  for update using (auth.uid() = id);
