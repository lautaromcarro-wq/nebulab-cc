-- supabase/migrations/20260422120000_workspace_metering.sql
--
-- Usage metering per workspace. Tracks daily counters for billing-relevant
-- metrics. Populated by edge functions via track_usage() RPC so we never
-- touch this table from the client.

CREATE TABLE workspace_usage_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  metric_key TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, date, metric_key)
);

CREATE INDEX idx_workspace_usage_daily_workspace_date
  ON workspace_usage_daily (workspace_id, date DESC);

CREATE INDEX idx_workspace_usage_daily_metric
  ON workspace_usage_daily (metric_key, date DESC);

ALTER TABLE workspace_usage_daily ENABLE ROW LEVEL SECURITY;

-- Read-only from the app: workspace members can see their own usage.
CREATE POLICY "members read own usage" ON workspace_usage_daily
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Writes go through the service role only (edge functions).
CREATE POLICY "service role writes" ON workspace_usage_daily
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── track_usage RPC ──────────────────────────────────────────────────────────
-- Idempotent upsert-and-increment. Called from edge functions.
-- p_increment can be negative to decrement if needed.

CREATE OR REPLACE FUNCTION track_usage(
  p_workspace_id uuid,
  p_metric_key TEXT,
  p_increment NUMERIC DEFAULT 1,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO workspace_usage_daily (workspace_id, date, metric_key, value, updated_at)
  VALUES (p_workspace_id, p_date, p_metric_key, p_increment, now())
  ON CONFLICT (workspace_id, date, metric_key)
  DO UPDATE SET
    value = workspace_usage_daily.value + EXCLUDED.value,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION track_usage(uuid, TEXT, NUMERIC, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION track_usage(uuid, TEXT, NUMERIC, DATE) TO service_role;

-- ── Metric key conventions (documented for future readers) ───────────────────
-- sync.meta.accounts_discovered
-- sync.meta.insights_rows
-- sync.google.insights_rows
-- sync.ga4.events_rows
-- sync.ecommerce.orders_ingested
-- ai.analyst.calls
-- ai.analyst.tokens_in
-- ai.analyst.tokens_out
-- report.weekly.sent
-- Keep keys dot-separated and lowercase. Add new keys here when you introduce
-- new metrics so it stays discoverable.
