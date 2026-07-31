-- ============================================================
-- Migration 013: Ownership Verification for Exploit Scanning
-- ============================================================
-- Adds ownership verification enforcement so exploit scanning
-- can only run against targets the user has proven ownership of.
-- ============================================================

-- ============================================================
-- 1. Add verification columns to repositories table
--    (GitHub App-connected repos are auto-verified)
-- ============================================================

DO $$ BEGIN
  -- verification_status column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='repositories' AND column_name='verification_status') THEN
    ALTER TABLE public.repositories ADD COLUMN verification_status text NOT NULL DEFAULT 'verified'
      CHECK (verification_status IN ('unverified', 'pending', 'verified', 'failed'));
  END IF;

  -- verification_method column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='repositories' AND column_name='verification_method') THEN
    ALTER TABLE public.repositories ADD COLUMN verification_method text DEFAULT NULL
      CHECK (verification_method IN ('github_app', 'dns_txt', 'file_upload'));
  END IF;

  -- verified_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='repositories' AND column_name='verified_at') THEN
    ALTER TABLE public.repositories ADD COLUMN verified_at timestamptz DEFAULT NULL;
  END IF;

  -- verification_token column (for DNS TXT / file upload challenges)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='repositories' AND column_name='verification_token') THEN
    ALTER TABLE public.repositories ADD COLUMN verification_token text DEFAULT NULL;
  END IF;

  -- Set existing repos as verified via GitHub App (they're already GitHub-connected)
  UPDATE public.repositories
  SET verification_status = 'verified',
      verification_method = 'github_app',
      verified_at = COALESCE(verified_at, now())
  WHERE verification_status = 'unverified';
END $$;

-- ============================================================
-- 2. Add verification tracking columns to exploit_scan_jobs
--    (snapshot of verification state at time of scan creation)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='exploit_scan_jobs' AND column_name='verification_method') THEN
    ALTER TABLE public.exploit_scan_jobs ADD COLUMN verification_method text DEFAULT NULL
      CHECK (verification_method IN ('github_app', 'dns_txt', 'file_upload'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='exploit_scan_jobs' AND column_name='verified_at') THEN
    ALTER TABLE public.exploit_scan_jobs ADD COLUMN verified_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- ============================================================
-- 3. Create scan_authorizations table (TOC/legal consent)
--    Separate from technical verification — this is the
--    user's explicit legal confirmation of ownership/authorization.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.scan_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_url text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('github_repo', 'live_url')),
  tos_version text NOT NULL DEFAULT '1.0',
  authorized_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz, -- 90 days from authorization
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_scan_authorizations_user_id ON public.scan_authorizations(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_authorizations_target_url ON public.scan_authorizations(target_url);
CREATE INDEX IF NOT EXISTS idx_scan_authorizations_expires ON public.scan_authorizations(expires_at) WHERE expires_at IS NOT NULL;

-- RLS
ALTER TABLE public.scan_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scan authorizations"
  ON public.scan_authorizations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scan authorizations"
  ON public.scan_authorizations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4. Add real-time updates for verification changes (skip if already added)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'exploit_scan_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.exploit_scan_jobs;
  END IF;
END $$;

-- ============================================================
-- 5. Function: check if a repository is verified for exploit scanning
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_repository_verification(repo_id uuid)
RETURNS TABLE (
  is_verified boolean,
  method text,
  verified_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.verification_status = 'verified' AS is_verified,
    r.verification_method AS method,
    r.verified_at AS verified_at
  FROM public.repositories r
  WHERE r.id = repo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
