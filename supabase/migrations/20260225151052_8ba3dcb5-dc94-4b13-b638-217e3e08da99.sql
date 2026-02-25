
-- Meta sync preferences per workspace
CREATE TABLE public.meta_sync_prefs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  mode text NOT NULL DEFAULT 'allowlist',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

ALTER TABLE public.meta_sync_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see meta_sync_prefs" ON public.meta_sync_prefs
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins manage meta_sync_prefs insert" ON public.meta_sync_prefs
  FOR INSERT WITH CHECK (is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins manage meta_sync_prefs update" ON public.meta_sync_prefs
  FOR UPDATE USING (is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins manage meta_sync_prefs delete" ON public.meta_sync_prefs
  FOR DELETE USING (is_workspace_admin(auth.uid(), workspace_id));

-- Allowed businesses (BMs)
CREATE TABLE public.meta_allowed_businesses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  business_id text NOT NULL,
  business_name text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, business_id)
);

ALTER TABLE public.meta_allowed_businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see meta_allowed_businesses" ON public.meta_allowed_businesses
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins manage meta_allowed_businesses insert" ON public.meta_allowed_businesses
  FOR INSERT WITH CHECK (is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins manage meta_allowed_businesses update" ON public.meta_allowed_businesses
  FOR UPDATE USING (is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins manage meta_allowed_businesses delete" ON public.meta_allowed_businesses
  FOR DELETE USING (is_workspace_admin(auth.uid(), workspace_id));

-- Allowed accounts (per-account override)
CREATE TABLE public.meta_allowed_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  account_name text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, account_id)
);

ALTER TABLE public.meta_allowed_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see meta_allowed_accounts" ON public.meta_allowed_accounts
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins manage meta_allowed_accounts insert" ON public.meta_allowed_accounts
  FOR INSERT WITH CHECK (is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins manage meta_allowed_accounts update" ON public.meta_allowed_accounts
  FOR UPDATE USING (is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins manage meta_allowed_accounts delete" ON public.meta_allowed_accounts
  FOR DELETE USING (is_workspace_admin(auth.uid(), workspace_id));
