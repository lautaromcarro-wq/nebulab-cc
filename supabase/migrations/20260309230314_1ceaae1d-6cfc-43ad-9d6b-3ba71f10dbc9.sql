
-- client_reports
CREATE TABLE IF NOT EXISTS client_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token         uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  title         text,
  period_from   date,
  period_to     date,
  report_data   jsonb NOT NULL DEFAULT '{}',
  created_by    uuid,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_reports_workspace_id_idx ON client_reports(workspace_id);
CREATE INDEX IF NOT EXISTS client_reports_client_id_idx ON client_reports(client_id);
CREATE INDEX IF NOT EXISTS client_reports_token_idx ON client_reports(token);

ALTER TABLE client_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "workspace_member_client_reports" ON client_reports;
  DROP POLICY IF EXISTS "public_read_client_reports_by_token" ON client_reports;
END $$;

CREATE POLICY "workspace_member_client_reports"
  ON client_reports FOR ALL
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "public_read_client_reports_by_token"
  ON client_reports FOR SELECT
  USING (true);

-- client_access_tokens
CREATE TABLE IF NOT EXISTS client_access_tokens (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id        uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token            uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  label            text,
  active           boolean NOT NULL DEFAULT true,
  last_accessed_at timestamptz,
  created_by       uuid,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_access_tokens_workspace_id_idx ON client_access_tokens(workspace_id);
CREATE INDEX IF NOT EXISTS client_access_tokens_client_id_idx ON client_access_tokens(client_id);
CREATE INDEX IF NOT EXISTS client_access_tokens_token_idx ON client_access_tokens(token);

ALTER TABLE client_access_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "workspace_member_client_access_tokens" ON client_access_tokens;
  DROP POLICY IF EXISTS "public_read_client_access_tokens" ON client_access_tokens;
END $$;

CREATE POLICY "workspace_member_client_access_tokens"
  ON client_access_tokens FOR ALL
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "public_read_client_access_tokens"
  ON client_access_tokens FOR SELECT
  USING (true);
