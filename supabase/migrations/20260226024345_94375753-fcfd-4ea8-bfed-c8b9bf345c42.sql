
-- Unified account settings table for per-account sync control
CREATE TABLE public.workspace_account_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  provider TEXT NOT NULL, -- 'meta', 'google_ads', 'ga4'
  external_id TEXT NOT NULL, -- external_account_id (e.g. act_XXX or customer_id)
  external_group_id TEXT, -- business_id for Meta, login_customer_id for Google
  external_group_name TEXT, -- business_name for Meta, MCC name for Google
  account_name TEXT NOT NULL DEFAULT '',
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, provider, external_id)
);

-- Enable RLS
ALTER TABLE public.workspace_account_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members see workspace_account_settings"
  ON public.workspace_account_settings FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins insert workspace_account_settings"
  ON public.workspace_account_settings FOR INSERT
  WITH CHECK (is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins update workspace_account_settings"
  ON public.workspace_account_settings FOR UPDATE
  USING (is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins delete workspace_account_settings"
  ON public.workspace_account_settings FOR DELETE
  USING (is_workspace_admin(auth.uid(), workspace_id));

-- Index for sync queries
CREATE INDEX idx_was_provider_workspace ON public.workspace_account_settings(workspace_id, provider, is_enabled);

-- Updated_at trigger
CREATE TRIGGER update_workspace_account_settings_updated_at
  BEFORE UPDATE ON public.workspace_account_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
