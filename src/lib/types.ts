export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: "free" | "pro";
  created_at: string;
};

export type Repository = {
  id: string;
  user_id: string;
  github_repo_id: number | null;
  full_name: string;
  is_active: boolean;
  webhook_id: number | null;
  default_branch: string;
  verification_status: "unverified" | "pending" | "verified" | "failed";
  verification_method: "github_app" | "dns_txt" | "file_upload" | null;
  verified_at: string | null;
  verification_token: string | null;
  created_at: string;
};

export type RepositorySettings = {
  id: string;
  repository_id: string;
  min_severity: "Low" | "Medium" | "High" | "Critical";
  include_paths: string[];
  exclude_paths: string[];
  enable_ai_scan: boolean;
  enable_auto_pr: boolean;
  scan_only_changes: boolean;
  ignored_types: string[];
  created_at: string;
  updated_at: string;
};

export type Scan = {
  id: string;
  repository_id: string;
  commit_sha: string | null;
  branch: string | null;
  status: "pending" | "scanning" | "clean" | "vulnerable" | "fixed";
  triggered_at: string;
  completed_at: string | null;
  repositories?: Pick<Repository, "full_name">;
};

export type Vulnerability = {
  id: string;
  scan_id: string;
  file_path: string | null;
  vulnerability_type: string | null;
  severity: "Low" | "Medium" | "High" | "Critical";
  plain_english_explanation: string | null;
  vulnerable_code: string | null;
  fixed_code: string | null;
  pr_url: string | null;
  status: "open" | "fixed" | "dismissed" | "snoozed";
  snoozed_until: string | null;
  line?: number;
  updated_at?: string;
  created_at: string;
};

export type Team = {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type TeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  role: "owner" | "admin" | "developer" | "viewer";
  joined_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  };
};

export type TeamInvitation = {
  id: string;
  team_id: string;
  email: string;
  role: "admin" | "developer" | "viewer";
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type ExploitScanJob = {
  id: string;
  user_id: string;
  target_url: string;
  repository_id: string | null;
  status: "pending" | "running" | "completed" | "failed";
  vulnerability_ids: string[];
  total_exploits: number;
  results_summary: Record<string, number>;
  verification_method: "github_app" | "dns_txt" | "file_upload" | null;
  verified_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExploitResult = {
  id: string;
  job_id: string;
  vulnerability_id: string | null;
  target_url: string;
  exploit_type: string;
  result: "exploitable" | "false_positive" | "blocked" | "error";
  details: Record<string, unknown>;
  http_status: number | null;
  response_headers: Record<string, string> | null;
  error_message: string | null;
  created_at: string;
};

export type VulnerabilityVerification = {
  id: string;
  vulnerability_id: string;
  job_id: string;
  is_real_exploit: boolean;
  confidence: number;
  reasoning: string;
  missing_indicators: string[];
  suggested_tests: string[];
  created_at: string;
};

export type FixReview = {
  id: string;
  vulnerability_id: string;
  pass: boolean;
  score: number;
  confidence: number;
  issues: string[];
  suggestions: string[];
  security_risks: string[];
  created_at: string;
};

export type VulnerabilityTriage = {
  id: string;
  scan_id: string;
  vulnerability_id: string;
  priority_score: number;
  reasoning: string;
  exploit_chain: string;
  remediation_order: number;
  created_at: string;
};

export type ScanAuthorization = {
  id: string;
  user_id: string;
  target_url: string;
  target_type: "github_repo" | "live_url";
  tos_version: string;
  authorized_at: string;
  expires_at: string | null;
  created_at: string;
};
