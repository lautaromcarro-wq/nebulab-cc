
-- sync_locks table
CREATE TABLE public.sync_locks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  provider text NOT NULL,
  job_name text NOT NULL,
  locked_until timestamptz NOT NULL,
  lock_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_sync_locks_active ON public.sync_locks (workspace_id, provider, job_name);

ALTER TABLE public.sync_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see sync_locks" ON public.sync_locks
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));

-- risk_events table
CREATE TABLE public.risk_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  provider text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  code text NOT NULL,
  message text NOT NULL,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see risk_events" ON public.risk_events
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));

-- Unique constraints on daily tables (use IF NOT EXISTS via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_performance_daily_key'
  ) THEN
    CREATE UNIQUE INDEX uq_performance_daily_key
      ON public.performance_daily (workspace_id, provider, account_id, date, entity_type, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_segment_daily_key'
  ) THEN
    CREATE UNIQUE INDEX uq_segment_daily_key
      ON public.segment_daily (workspace_id, segment_id, date);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_campaign_segment_map_key'
  ) THEN
    CREATE UNIQUE INDEX uq_campaign_segment_map_key
      ON public.campaign_segment_map (workspace_id, platform, campaign_id);
  END IF;
END$$;
