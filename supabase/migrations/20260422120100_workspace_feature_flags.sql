-- supabase/migrations/20260422120100_workspace_feature_flags.sql
--
-- Feature flags per workspace. Lets us turn features on/off without deploys,
-- run pilots with specific clients, and later power pricing tiers when this
-- project migrates from internal tool to SaaS.

CREATE TABLE workspace_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, feature_key)
);

CREATE INDEX idx_workspace_features_workspace
  ON workspace_features (workspace_id);

ALTER TABLE workspace_features ENABLE ROW LEVEL SECURITY;

-- Members can read flags for their own workspaces.
CREATE POLICY "members read own flags" ON workspace_features
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Only workspace owners can toggle flags from the client.
CREATE POLICY "owners write own flags" ON workspace_features
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  ) WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Service role bypass for backend toggles (e.g. billing webhooks later).
CREATE POLICY "service role writes" ON workspace_features
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION touch_workspace_features_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workspace_features_updated_at
  BEFORE UPDATE ON workspace_features
  FOR EACH ROW EXECUTE FUNCTION touch_workspace_features_updated_at();

-- ── is_feature_enabled RPC ───────────────────────────────────────────────────
-- Resolves a feature flag for a workspace. Defaults to false if no row exists.
-- Usable from client (through RPC) or edge functions.

CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_workspace_id uuid,
  p_feature_key TEXT
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM workspace_features
      WHERE workspace_id = p_workspace_id AND feature_key = p_feature_key),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION is_feature_enabled(uuid, TEXT) TO authenticated, service_role;

-- ── Feature key conventions (documented for future readers) ──────────────────
-- ecommerce.tiendanube
-- ecommerce.woocommerce
-- ai.analyst
-- experiments
-- reports.weekly_email
-- segments.auto_mapping
-- diagnostics.advanced
-- Keep keys dot-separated and lowercase. Add new keys here when you introduce
-- new gated features so it stays discoverable.
