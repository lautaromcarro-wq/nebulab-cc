
-- Create backfill_runs table for tracking historical backfill progress
CREATE TABLE public.backfill_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  provider TEXT NOT NULL, -- meta | google_ads | ga4 | all
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  chunk_size_days INTEGER NOT NULL DEFAULT 30,
  current_chunk_start DATE,
  current_chunk_end DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | running | completed | failed
  items_inserted INTEGER NOT NULL DEFAULT 0,
  chunks_total INTEGER NOT NULL DEFAULT 0,
  chunks_completed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.backfill_runs ENABLE ROW LEVEL SECURITY;

-- Members can view backfill runs
CREATE POLICY "Members see backfill_runs"
  ON public.backfill_runs FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

-- Admins can manage backfill runs
CREATE POLICY "Admins manage backfill_runs"
  ON public.backfill_runs FOR ALL
  USING (is_workspace_admin(auth.uid(), workspace_id));

-- Index for quick lookups
CREATE INDEX idx_backfill_runs_workspace_status
  ON public.backfill_runs(workspace_id, status);

-- Trigger for updated_at
CREATE TRIGGER update_backfill_runs_updated_at
  BEFORE UPDATE ON public.backfill_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
