-- ============================================================
-- Migration 015: Security monitoring and incident response
-- ============================================================

-- 0. Extend profiles before admin policies depend on them
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

-- 1. Security event storage
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ip_address text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  auto_action_taken boolean NOT NULL DEFAULT false
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view security events"
  ON public.security_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

CREATE POLICY "Service role can manage security events"
  ON public.security_events FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Security action audit trail
CREATE TABLE IF NOT EXISTS public.security_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.security_events(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  reason text NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz
);

ALTER TABLE public.security_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view security actions"
  ON public.security_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

CREATE POLICY "Service role can manage security actions"
  ON public.security_actions FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Security settings and controls
CREATE TABLE IF NOT EXISTS public.security_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  note text
);

ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view security settings"
  ON public.security_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

CREATE POLICY "Service role can manage security settings"
  ON public.security_settings FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Extend api_keys with revocation support
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_until timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_reason text,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 6. Allow exploit scan jobs to be paused when suspicious activity is detected
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
      AND constraint_name = 'exploit_scan_jobs_status_check'
  ) THEN
    ALTER TABLE public.exploit_scan_jobs
      DROP CONSTRAINT IF EXISTS exploit_scan_jobs_status_check;
  END IF;
END $$;

ALTER TABLE public.exploit_scan_jobs
  DROP CONSTRAINT IF EXISTS exploit_scan_jobs_status_check;

ALTER TABLE public.exploit_scan_jobs
  ADD CONSTRAINT exploit_scan_jobs_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'paused'));

-- Indexes for admin review and fast lookups
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_actions_event_id ON public.security_actions(event_id);
CREATE INDEX IF NOT EXISTS idx_security_settings_updated_at ON public.security_settings(updated_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON public.api_keys(is_active);
