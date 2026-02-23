
-- ============================================================
-- NEBULAB: Full Database Schema — Multi-Tenant Performance Marketing
-- ============================================================

-- 1) ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'analyst', 'viewer');
CREATE TYPE public.workspace_status AS ENUM ('active', 'paused');
CREATE TYPE public.integration_provider AS ENUM ('meta', 'google_ads', 'ga4');
CREATE TYPE public.integration_status AS ENUM ('connected', 'degraded', 'disconnected');
CREATE TYPE public.entity_type AS ENUM ('account', 'campaign', 'adset', 'ad', 'creative', 'platform_total');
CREATE TYPE public.creative_type AS ENUM ('video', 'image', 'carousel', 'text', 'other');
CREATE TYPE public.asset_type AS ENUM ('video', 'image', 'other');
CREATE TYPE public.change_type AS ENUM ('budget', 'targeting', 'creative', 'landing', 'bidding', 'tracking', 'other');
CREATE TYPE public.changelog_status AS ENUM ('planned', 'applied', 'reverted');
CREATE TYPE public.experiment_status AS ENUM ('planned', 'running', 'done', 'killed');
CREATE TYPE public.experiment_decision AS ENUM ('scale', 'iterate', 'stop', 'unknown');
CREATE TYPE public.cost_type AS ENUM ('cogs', 'shipping', 'platform_fees', 'taxes', 'fulfillment', 'other');
CREATE TYPE public.revenue_source AS ENUM ('shopify', 'manual', 'csv', 'erp');
CREATE TYPE public.alert_rule_type AS ENUM ('pacing', 'anomaly', 'health');
CREATE TYPE public.alert_severity AS ENUM ('info', 'warn', 'critical');
CREATE TYPE public.alert_entity_scope AS ENUM ('workspace', 'account', 'campaign', 'adset', 'ad', 'creative');
CREATE TYPE public.sync_status AS ENUM ('running', 'success', 'partial', 'error');
CREATE TYPE public.changelog_entity_type AS ENUM ('campaign', 'adset', 'ad', 'creative', 'landing');
CREATE TYPE public.workspace_member_status AS ENUM ('active', 'invited', 'disabled');
CREATE TYPE public.account_status AS ENUM ('active', 'disabled');
CREATE TYPE public.identity_confidence AS ENUM ('high', 'medium', 'low');

-- ============================================================
-- 2) WORKSPACES
-- ============================================================
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status public.workspace_status NOT NULL DEFAULT 'active',
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  currency TEXT NOT NULL DEFAULT 'USD',
  monthly_budget NUMERIC(18,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workspaces_status ON public.workspaces(status);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3) WORKSPACE MEMBERS
-- ============================================================
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  status public.workspace_member_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);
CREATE INDEX idx_wm_workspace ON public.workspace_members(workspace_id);
CREATE INDEX idx_wm_user ON public.workspace_members(user_id);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4) USER ROLES
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5) SECURITY DEFINER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id AND status = 'active')
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_role(_user_id UUID, _workspace_id UUID)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id AND status = 'active' LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id AND role = 'admin' AND status = 'active')
$$;

-- ============================================================
-- 6) INTEGRATIONS
-- ============================================================
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider public.integration_provider NOT NULL,
  status public.integration_status NOT NULL DEFAULT 'disconnected',
  scopes TEXT[] NOT NULL DEFAULT '{}',
  token_expires_at TIMESTAMPTZ,
  token_health JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, provider)
);
CREATE INDEX idx_integrations_workspace ON public.integrations(workspace_id);
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7) CREDENTIALS
-- ============================================================
CREATE TABLE public.credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL UNIQUE REFERENCES public.integrations(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  meta_long_lived_token TEXT,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_credentials_workspace ON public.credentials(workspace_id);
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8) ACCOUNTS
-- ============================================================
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE SET NULL,
  provider public.integration_provider NOT NULL,
  external_account_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  parent_external_id TEXT,
  currency TEXT,
  timezone TEXT,
  status public.account_status NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, provider, external_account_id)
);
CREATE INDEX idx_accounts_workspace ON public.accounts(workspace_id);
CREATE INDEX idx_accounts_external ON public.accounts(external_account_id);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9) CAMPAIGNS
-- ============================================================
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  provider public.integration_provider NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  objective TEXT,
  start_date DATE,
  end_date DATE,
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, provider, external_id)
);
CREATE INDEX idx_campaigns_workspace ON public.campaigns(workspace_id);
CREATE INDEX idx_campaigns_account ON public.campaigns(account_id);
CREATE INDEX idx_campaigns_external ON public.campaigns(external_id);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 10) ADSETS
-- ============================================================
CREATE TABLE public.adsets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  provider public.integration_provider NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  targeting JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, provider, external_id)
);
CREATE INDEX idx_adsets_workspace ON public.adsets(workspace_id);
CREATE INDEX idx_adsets_campaign ON public.adsets(campaign_id);
ALTER TABLE public.adsets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 11) CREATIVES
-- ============================================================
CREATE TABLE public.creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  canonical_hash TEXT NOT NULL,
  canonical_url TEXT,
  creative_type public.creative_type NOT NULL DEFAULT 'other',
  duration_sec INTEGER,
  dimensions TEXT,
  headline TEXT,
  primary_text TEXT,
  cta TEXT,
  identity_confidence public.identity_confidence NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, canonical_hash)
);
CREATE INDEX idx_creatives_workspace ON public.creatives(workspace_id);
ALTER TABLE public.creatives ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 12) CREATIVE ASSETS
-- ============================================================
CREATE TABLE public.creative_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  creative_id UUID REFERENCES public.creatives(id) ON DELETE SET NULL,
  provider public.integration_provider NOT NULL,
  external_asset_id TEXT,
  asset_url TEXT NOT NULL DEFAULT '',
  asset_hash TEXT,
  asset_type public.asset_type NOT NULL DEFAULT 'other',
  thumbnail_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ca_workspace ON public.creative_assets(workspace_id);
CREATE INDEX idx_ca_hash ON public.creative_assets(asset_hash);
ALTER TABLE public.creative_assets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 13) ADS
-- ============================================================
CREATE TABLE public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  adset_id UUID REFERENCES public.adsets(id) ON DELETE SET NULL,
  provider public.integration_provider NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  creative_id UUID REFERENCES public.creatives(id) ON DELETE SET NULL,
  landing_url TEXT,
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, provider, external_id)
);
CREATE INDEX idx_ads_workspace ON public.ads(workspace_id);
CREATE INDEX idx_ads_campaign ON public.ads(campaign_id);
CREATE INDEX idx_ads_adset ON public.ads(adset_id);
CREATE INDEX idx_ads_creative ON public.ads(creative_id);
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 14) CREATIVE TAGS
-- ============================================================
CREATE TABLE public.creative_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_ct_unique ON public.creative_tags(workspace_id, COALESCE(category, ''), name);
CREATE INDEX idx_ct_workspace ON public.creative_tags(workspace_id);
ALTER TABLE public.creative_tags ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 15) CREATIVE TAG LINKS
-- ============================================================
CREATE TABLE public.creative_tag_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  creative_id UUID NOT NULL REFERENCES public.creatives(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.creative_tags(id) ON DELETE CASCADE,
  UNIQUE(workspace_id, creative_id, tag_id)
);
CREATE INDEX idx_ctl_workspace ON public.creative_tag_links(workspace_id);
CREATE INDEX idx_ctl_creative ON public.creative_tag_links(creative_id);
ALTER TABLE public.creative_tag_links ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 16) PERFORMANCE DAILY
-- ============================================================
CREATE TABLE public.performance_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider public.integration_provider NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  entity_type public.entity_type NOT NULL,
  entity_id UUID,
  spend NUMERIC(18,2) NOT NULL DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  purchases BIGINT DEFAULT 0,
  revenue NUMERIC(18,2) DEFAULT 0,
  sessions BIGINT,
  users_count BIGINT,
  notes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_pd_unique ON public.performance_daily(workspace_id, provider, account_id, date, entity_type, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'));
CREATE INDEX idx_pd_workspace ON public.performance_daily(workspace_id);
CREATE INDEX idx_pd_date ON public.performance_daily(date);
CREATE INDEX idx_pd_provider ON public.performance_daily(provider);
CREATE INDEX idx_pd_entity ON public.performance_daily(entity_type, entity_id);
ALTER TABLE public.performance_daily ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 17) FINANCE REVENUE
-- ============================================================
CREATE TABLE public.finance_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source public.revenue_source NOT NULL DEFAULT 'manual',
  gross_revenue NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_revenue NUMERIC(18,2),
  orders INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, date, source)
);
CREATE INDEX idx_fr_workspace ON public.finance_revenue(workspace_id);
CREATE INDEX idx_fr_date ON public.finance_revenue(date);
ALTER TABLE public.finance_revenue ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 18) FINANCE COSTS
-- ============================================================
CREATE TABLE public.finance_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  cost_type public.cost_type NOT NULL,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, date, cost_type)
);
CREATE INDEX idx_fc_workspace ON public.finance_costs(workspace_id);
CREATE INDEX idx_fc_date ON public.finance_costs(date);
ALTER TABLE public.finance_costs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 19) CHANGELOG
-- ============================================================
CREATE TABLE public.changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_type public.change_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  expected_impact TEXT,
  status public.changelog_status NOT NULL DEFAULT 'applied',
  template_key TEXT,
  platform TEXT
);
CREATE INDEX idx_cl_workspace ON public.changelog(workspace_id);
CREATE INDEX idx_cl_created_at ON public.changelog(created_at);
ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 20) CHANGELOG LINKS
-- ============================================================
CREATE TABLE public.changelog_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  changelog_id UUID NOT NULL REFERENCES public.changelog(id) ON DELETE CASCADE,
  entity_type public.changelog_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  UNIQUE(workspace_id, changelog_id, entity_type, entity_id)
);
CREATE INDEX idx_cll_workspace ON public.changelog_links(workspace_id);
CREATE INDEX idx_cll_changelog ON public.changelog_links(changelog_id);
ALTER TABLE public.changelog_links ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 21) EXPERIMENTS
-- ============================================================
CREATE TABLE public.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  hypothesis TEXT NOT NULL,
  metric_primary TEXT NOT NULL DEFAULT 'CPA',
  start_date DATE,
  end_date DATE,
  status public.experiment_status NOT NULL DEFAULT 'planned',
  result_summary TEXT,
  decision public.experiment_decision,
  linked_changelog_id UUID REFERENCES public.changelog(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_exp_workspace ON public.experiments(workspace_id);
CREATE INDEX idx_exp_status ON public.experiments(status);
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 22) ALERT RULES
-- ============================================================
CREATE TABLE public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type public.alert_rule_type NOT NULL,
  entity_scope public.alert_entity_scope NOT NULL DEFAULT 'workspace',
  provider_scope TEXT[] DEFAULT '{}',
  condition JSONB NOT NULL DEFAULT '{}',
  severity public.alert_severity NOT NULL DEFAULT 'info',
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  cooldown_minutes INTEGER NOT NULL DEFAULT 180,
  destinations JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name)
);
CREATE INDEX idx_ar_workspace ON public.alert_rules(workspace_id);
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 23) SYNC RUNS
-- ============================================================
CREATE TABLE public.sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE SET NULL,
  provider public.integration_provider NOT NULL,
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status public.sync_status NOT NULL DEFAULT 'running',
  items_upserted INTEGER DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}'
);
CREATE INDEX idx_sr_workspace ON public.sync_runs(workspace_id);
CREATE INDEX idx_sr_started ON public.sync_runs(started_at);
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 24) HEALTH EVENTS
-- ============================================================
CREATE TABLE public.health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'info',
  entity_type public.entity_type,
  entity_id UUID,
  provider public.integration_provider,
  message TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_he_workspace ON public.health_events(workspace_id);
CREATE INDEX idx_he_created ON public.health_events(created_at);
ALTER TABLE public.health_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 25) PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 26) RLS POLICIES
-- ============================================================

-- PROFILES
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- USER ROLES
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- WORKSPACES
CREATE POLICY "Members see workspaces" ON public.workspaces FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), id));
CREATE POLICY "Admins update workspace" ON public.workspaces FOR UPDATE TO authenticated USING (public.is_workspace_admin(auth.uid(), id));

-- WORKSPACE MEMBERS
CREATE POLICY "Members see co-members" ON public.workspace_members FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins insert members" ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admins update members" ON public.workspace_members FOR UPDATE TO authenticated USING (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admins delete members" ON public.workspace_members FOR DELETE TO authenticated USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- INTEGRATIONS
CREATE POLICY "Members see integrations" ON public.integrations FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins insert integrations" ON public.integrations FOR INSERT TO authenticated WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admins update integrations" ON public.integrations FOR UPDATE TO authenticated USING (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admins delete integrations" ON public.integrations FOR DELETE TO authenticated USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- CREDENTIALS (admin only)
CREATE POLICY "Admins see credentials" ON public.credentials FOR SELECT TO authenticated USING (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admins insert credentials" ON public.credentials FOR INSERT TO authenticated WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admins update credentials" ON public.credentials FOR UPDATE TO authenticated USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- ACCOUNTS
CREATE POLICY "Members see accounts" ON public.accounts FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

-- CAMPAIGNS
CREATE POLICY "Members see campaigns" ON public.campaigns FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

-- ADSETS
CREATE POLICY "Members see adsets" ON public.adsets FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

-- ADS
CREATE POLICY "Members see ads" ON public.ads FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

-- CREATIVES
CREATE POLICY "Members see creatives" ON public.creatives FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

-- CREATIVE ASSETS
CREATE POLICY "Members see creative_assets" ON public.creative_assets FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

-- CREATIVE TAGS
CREATE POLICY "Members see tags" ON public.creative_tags FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Analyst+ insert tags" ON public.creative_tags FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst'));
CREATE POLICY "Analyst+ update tags" ON public.creative_tags FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst'));
CREATE POLICY "Analyst+ delete tags" ON public.creative_tags FOR DELETE TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst'));

-- CREATIVE TAG LINKS
CREATE POLICY "Members see tag links" ON public.creative_tag_links FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Analyst+ insert tag links" ON public.creative_tag_links FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst'));
CREATE POLICY "Analyst+ delete tag links" ON public.creative_tag_links FOR DELETE TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst'));

-- PERFORMANCE DAILY
CREATE POLICY "Members see performance" ON public.performance_daily FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

-- FINANCE REVENUE (analyst+)
CREATE POLICY "Analyst+ see revenue" ON public.finance_revenue FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst'));
CREATE POLICY "Analyst+ insert revenue" ON public.finance_revenue FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst'));
CREATE POLICY "Analyst+ update revenue" ON public.finance_revenue FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst'));

-- FINANCE COSTS (analyst+)
CREATE POLICY "Analyst+ see costs" ON public.finance_costs FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst'));
CREATE POLICY "Analyst+ insert costs" ON public.finance_costs FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst'));
CREATE POLICY "Analyst+ update costs" ON public.finance_costs FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst'));

-- CHANGELOG
CREATE POLICY "Members see changelog" ON public.changelog FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Analyst+ create changelog" ON public.changelog FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst'));
CREATE POLICY "Analyst+ update changelog" ON public.changelog FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst'));

-- CHANGELOG LINKS
CREATE POLICY "Members see changelog links" ON public.changelog_links FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Analyst+ insert changelog links" ON public.changelog_links FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst'));

-- EXPERIMENTS
CREATE POLICY "Members see experiments" ON public.experiments FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Analyst+ create experiments" ON public.experiments FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst'));
CREATE POLICY "Analyst+ update experiments" ON public.experiments FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst'));

-- ALERT RULES
CREATE POLICY "Members see alert rules" ON public.alert_rules FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admin manage alert rules insert" ON public.alert_rules FOR INSERT TO authenticated WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admin manage alert rules update" ON public.alert_rules FOR UPDATE TO authenticated USING (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admin manage alert rules delete" ON public.alert_rules FOR DELETE TO authenticated USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- SYNC RUNS
CREATE POLICY "Members see sync runs" ON public.sync_runs FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

-- HEALTH EVENTS
CREATE POLICY "Members see health events" ON public.health_events FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

-- ============================================================
-- 27) TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_adsets_updated_at BEFORE UPDATE ON public.adsets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ads_updated_at BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_credentials_updated_at BEFORE UPDATE ON public.credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
