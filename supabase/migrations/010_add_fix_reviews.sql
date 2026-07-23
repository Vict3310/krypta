-- Migration: Add fix_reviews table
-- Stores AI-generated reviews of auto-generated code fixes
-- Applied: 2026-07-23

CREATE TABLE IF NOT EXISTS fix_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vulnerability_id UUID NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
  pass BOOLEAN NOT NULL,
  score NUMERIC(2,1) NOT NULL, -- 0.0 to 10.0
  confidence NUMERIC(3,2) NOT NULL, -- 0.00 to 1.00
  issues TEXT[] DEFAULT '{}',
  suggestions TEXT[] DEFAULT '{}',
  security_risks TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_fix_reviews_vuln ON fix_reviews(vulnerability_id);

-- Row Level Security
ALTER TABLE fix_reviews ENABLE ROW LEVEL SECURITY;

-- Users can only see reviews for their own vulnerabilities (via scans)
CREATE POLICY "Users can view their own fix reviews"
  ON fix_reviews
  FOR SELECT
  USING (
    vulnerability_id IN (
      SELECT v.id FROM vulnerabilities v
      JOIN scans s ON v.scan_id = s.id
      JOIN repositories r ON s.repository_id = r.id
      WHERE r.user_id = auth.uid()
    )
  );
