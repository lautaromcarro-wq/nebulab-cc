
-- Enum for segment status
CREATE TYPE public.segment_status AS ENUM ('active', 'inactive');

-- Enum for segment rule type
CREATE TYPE public.segment_rule_type AS ENUM ('contains', 'starts_with', 'regex', 'in_list');

-- Enum for segment rule platform
CREATE TYPE public.segment_rule_platform AS ENUM ('meta', 'google_ads', 'any');

-- Enum for segment rule entity level
CREATE TYPE public.segment_rule_entity_level AS ENUM ('campaign');

-- Enum for campaign segment match status
CREATE TYPE public.segment_match_status AS ENUM ('assigned', 'unassigned', 'conflict');

-- Enum for sync trigger
CREATE TYPE public.sync_trigger AS ENUM ('cron', 'manual');

-- =====================
-- 1) segments
-- =====================
CREATE TABLE public.segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status segment_status NOT NULL DEFAULT 'active',
  currency TEXT NOT NULL DEFAULT 'USD',
  monthly_budget NUMERIC(18,2) NOT NULL DEFAULT 0,
  tolerance_percent NUMERIC(5,4) NOT NULL DEFAULT 0.07,
  rolling_avg_days INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_segments_ws_name ON public.segments(workspace_id, name);
CREATE INDEX idx_segments_ws ON public.segments(workspace_id);
CREATE INDEX idx_segments_status ON public.segments(status);

ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see segments" ON public.segments
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admin insert segments" ON public.segments
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admin update segments" ON public.segments
  FOR UPDATE TO authenticated
  USING (is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admin delete segments" ON public.segments
  FOR DELETE TO authenticated
  USING (is_workspace_admin(auth.uid(), workspace_id));

CREATE TRIGGER update_segments_updated_at
  BEFORE UPDATE ON public.segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- 2) segment_rules
-- =====================
CREATE TABLE public.segment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
  platform segment_rule_platform NOT NULL DEFAULT 'any',
  entity_level segment_rule_entity_level NOT NULL DEFAULT 'campaign',
  rule_type segment_rule_type NOT NULL,
  rule_value TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  is_inclusive BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_sr_unique ON public.segment_rules(segment_id, platform, rule_type, rule_value);
CREATE INDEX idx_sr_ws ON public.segment_rules(workspace_id);
CREATE INDEX idx_sr_segment ON public.segment_rules(segment_id);

ALTER TABLE public.segment_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see segment_rules" ON public.segment_rules
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admin insert segment_rules" ON public.segment_rules
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admin update segment_rules" ON public.segment_rules
  FOR UPDATE TO authenticated
  USING (is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admin delete segment_rules" ON public.segment_rules
  FOR DELETE TO authenticated
  USING (is_workspace_admin(auth.uid(), workspace_id));

-- =====================
-- 3) campaign_segment_map
-- =====================
CREATE TABLE public.campaign_segment_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform integration_provider NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES public.segments(id) ON DELETE SET NULL,
  match_status segment_match_status NOT NULL DEFAULT 'unassigned',
  matched_rules JSONB DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_csm_unique ON public.campaign_segment_map(workspace_id, platform, campaign_id);
CREATE INDEX idx_csm_ws ON public.campaign_segment_map(workspace_id);
CREATE INDEX idx_csm_segment ON public.campaign_segment_map(segment_id);
CREATE INDEX idx_csm_campaign ON public.campaign_segment_map(campaign_id);
CREATE INDEX idx_csm_status ON public.campaign_segment_map(match_status);
CREATE INDEX idx_csm_computed ON public.campaign_segment_map(computed_at);

ALTER TABLE public.campaign_segment_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see campaign_segment_map" ON public.campaign_segment_map
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

-- Server-side only writes (sync jobs via service role)
-- No INSERT/UPDATE/DELETE policies for regular users

-- =====================
-- 4) segment_daily
-- =====================
CREATE TABLE public.segment_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  spend NUMERIC(18,2) NOT NULL DEFAULT 0,
  spend_meta NUMERIC(18,2) DEFAULT 0,
  spend_google NUMERIC(18,2) DEFAULT 0,
  purchases BIGINT DEFAULT 0,
  revenue_platform NUMERIC(18,2) DEFAULT 0,
  revenue_ga4 NUMERIC(18,2) DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_sd_unique ON public.segment_daily(workspace_id, segment_id, date);
CREATE INDEX idx_sd_ws ON public.segment_daily(workspace_id);
CREATE INDEX idx_sd_segment ON public.segment_daily(segment_id);
CREATE INDEX idx_sd_date ON public.segment_daily(date);

ALTER TABLE public.segment_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see segment_daily" ON public.segment_daily
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

-- Server-side only writes

-- =====================
-- 5) Add triggered_by + triggered_user_id to sync_runs
-- =====================
ALTER TABLE public.sync_runs
  ADD COLUMN IF NOT EXISTS triggered_by sync_trigger DEFAULT 'cron',
  ADD COLUMN IF NOT EXISTS triggered_user_id UUID;
