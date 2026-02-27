
-- L4: Creative Intelligence - performance aggregation by creative
CREATE TABLE public.creative_performance_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  creative_id uuid NOT NULL REFERENCES public.creatives(id),
  date date NOT NULL,
  provider public.integration_provider NOT NULL,
  spend numeric NOT NULL DEFAULT 0,
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  purchases bigint DEFAULT 0,
  revenue numeric DEFAULT 0,
  currency text NOT NULL DEFAULT 'ARS',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint for UPSERT safety
CREATE UNIQUE INDEX idx_creative_perf_daily_unique
  ON public.creative_performance_daily (workspace_id, creative_id, date, provider);

-- Performance index
CREATE INDEX idx_creative_perf_daily_ws_date
  ON public.creative_performance_daily (workspace_id, date);

-- Enable RLS
ALTER TABLE public.creative_performance_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see creative_performance_daily"
  ON public.creative_performance_daily
  FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));
