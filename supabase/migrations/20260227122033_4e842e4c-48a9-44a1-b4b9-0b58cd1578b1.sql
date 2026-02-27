
-- ═══════════════════════════════════════════════
-- NEBULAB OS: Client Hub Architecture Migration
-- Single workspace, multi-client hub model
-- ═══════════════════════════════════════════════

-- A) CORE: clients table
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  notes text,
  website_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_workspace ON public.clients(workspace_id);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see clients" ON public.clients
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins insert clients" ON public.clients
  FOR INSERT WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admins update clients" ON public.clients
  FOR UPDATE USING (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admins delete clients" ON public.clients
  FOR DELETE USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- client_assets
CREATE TABLE public.client_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  asset_type text NOT NULL DEFAULT 'link',
  url text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see client_assets" ON public.client_assets
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins manage client_assets" ON public.client_assets
  FOR ALL USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- client_access_vault (no passwords, just references)
CREATE TABLE public.client_access_vault (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  system_name text NOT NULL,
  username_or_email text,
  notes text,
  vault_link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_access_vault ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins see vault" ON public.client_access_vault
  FOR SELECT USING (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admins manage vault" ON public.client_access_vault
  FOR ALL USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- buyer_persona
CREATE TABLE public.buyer_personas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  name text NOT NULL DEFAULT 'Primary',
  pain_points text[],
  jobs_to_be_done text[],
  objections text[],
  channels text[],
  demographics jsonb DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.buyer_personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see personas" ON public.buyer_personas
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins manage personas" ON public.buyer_personas
  FOR ALL USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE TRIGGER update_buyer_personas_updated_at
  BEFORE UPDATE ON public.buyer_personas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- competitors
CREATE TABLE public.competitors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  name text NOT NULL,
  url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see competitors" ON public.competitors
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins manage competitors" ON public.competitors
  FOR ALL USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- B) VERTICALS
CREATE TABLE public.client_verticals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  name text NOT NULL,
  business_model text NOT NULL DEFAULT 'ecom',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_verticals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see verticals" ON public.client_verticals
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins manage verticals" ON public.client_verticals
  FOR ALL USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE TRIGGER update_client_verticals_updated_at
  BEFORE UPDATE ON public.client_verticals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- C) CLIENT FINANCIAL SETTINGS
CREATE TABLE public.client_financial_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  avg_cogs_percent numeric NOT NULL DEFAULT 0,
  shipping_percent numeric NOT NULL DEFAULT 0,
  payment_fee_percent numeric NOT NULL DEFAULT 0,
  refund_percent numeric NOT NULL DEFAULT 0,
  iva_percent numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_financial_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view client financial" ON public.client_financial_settings
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins manage client financial" ON public.client_financial_settings
  FOR ALL USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE TRIGGER update_client_financial_settings_updated_at
  BEFORE UPDATE ON public.client_financial_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Optional: vertical-level overrides
CREATE TABLE public.client_vertical_financial_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vertical_id uuid NOT NULL REFERENCES public.client_verticals(id) ON DELETE CASCADE UNIQUE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  avg_cogs_percent numeric NOT NULL DEFAULT 0,
  shipping_percent numeric NOT NULL DEFAULT 0,
  payment_fee_percent numeric NOT NULL DEFAULT 0,
  refund_percent numeric NOT NULL DEFAULT 0,
  iva_percent numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_vertical_financial_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view vertical financial" ON public.client_vertical_financial_settings
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins manage vertical financial" ON public.client_vertical_financial_settings
  FOR ALL USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE TRIGGER update_client_vertical_financial_updated_at
  BEFORE UPDATE ON public.client_vertical_financial_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- D) CLIENT ACCOUNT SETTINGS (N:N link between clients and ad accounts)
CREATE TABLE public.client_account_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform text NOT NULL,
  external_account_id text NOT NULL,
  account_name text NOT NULL DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_client_account_settings_unique
  ON public.client_account_settings(workspace_id, client_id, platform, external_account_id);

ALTER TABLE public.client_account_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see client_account_settings" ON public.client_account_settings
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins manage client_account_settings" ON public.client_account_settings
  FOR ALL USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE TRIGGER update_client_account_settings_updated_at
  BEFORE UPDATE ON public.client_account_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- E) ADD client_id TO EXISTING DAILY TABLES
ALTER TABLE public.performance_daily ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.ga4_daily ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.ga4_by_source ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.segment_daily ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.workspace_revenue_daily ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.segments ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.segment_rules ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.campaign_segment_map ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.health_events ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.backfill_runs ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.sync_runs ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.workspace_health ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);

-- Indexes for client_id filtering on hot tables
CREATE INDEX IF NOT EXISTS idx_performance_daily_client ON public.performance_daily(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ga4_daily_client ON public.ga4_daily(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_segment_daily_client ON public.segment_daily(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_segments_client ON public.segments(client_id) WHERE client_id IS NOT NULL;

-- Helper function: check client membership via workspace
CREATE OR REPLACE FUNCTION public.is_client_member(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = _client_id AND wm.user_id = _user_id AND wm.status = 'active'
  )
$$;
