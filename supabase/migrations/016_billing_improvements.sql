-- ============================================================
-- KRYPTA: Billing Improvements Migration
-- Adds trial support, billing cycle tracking, cancellation,
-- and invoice history to profiles table.
-- Creates invoices table for payment tracking.
-- ============================================================

-- 1. Add billing fields to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Add index for cancellation queries
CREATE INDEX IF NOT EXISTS idx_profiles_cancelled_at ON public.profiles (cancelled_at) WHERE cancelled_at IS NOT NULL;

-- 2. Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL, -- in kobo
  currency TEXT NOT NULL DEFAULT 'NGN',
  tier TEXT NOT NULL DEFAULT 'pro' CHECK (tier IN ('free', 'pro', 'team')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  paystack_reference TEXT,
  paid_at TIMESTAMPTZ,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Users can view their own invoices
CREATE POLICY "Users can view own invoices" ON public.invoices
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert invoices (from webhook)
CREATE POLICY "Service role can insert invoices" ON public.invoices
  FOR INSERT WITH CHECK (true);

-- 3. Add team_members column to profiles (for team plans)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS team_members INTEGER NOT NULL DEFAULT 1;

-- 4. Update existing pro users to have trial_end_date set to NULL (they're paid, no trial)
-- This is safe because existing pro users don't have trial_end_date

-- 5. Add check constraint to ensure cancellation_reason is only present if cancelled
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_cancellation_reason CHECK (
    (cancelled_at IS NULL AND cancellation_reason IS NULL) OR
    (cancelled_at IS NOT NULL)
  );
