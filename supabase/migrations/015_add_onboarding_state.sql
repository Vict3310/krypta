-- ============================================================
-- KRYPTA: Add Onboarding State to Profiles
-- ============================================================

-- Add onboarding_completed flag and default_scan_settings to profiles
alter table public.profiles 
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists default_scan_settings jsonb not null default '{}'::jsonb;

-- Ensure Realtime continues to broadcast these changes if needed
-- (Already added to publication in 001_initial_schema.sql)
