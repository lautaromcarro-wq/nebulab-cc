
-- 1) Create workspace_revenue_daily table
CREATE TABLE public.workspace_revenue_daily (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  date date NOT NULL,
  total_revenue numeric NOT NULL DEFAULT 0,
  total_purchases bigint NOT NULL DEFAULT 0,
  source_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  currency text NOT NULL DEFAULT 'ARS',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, date)
);

-- Enable RLS
ALTER TABLE public.workspace_revenue_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see workspace_revenue_daily"
  ON public.workspace_revenue_daily FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

-- Trigger for updated_at
CREATE TRIGGER update_workspace_revenue_daily_updated_at
  BEFORE UPDATE ON public.workspace_revenue_daily
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Add currency column to performance_daily if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'performance_daily' AND column_name = 'currency'
  ) THEN
    ALTER TABLE public.performance_daily ADD COLUMN currency text NOT NULL DEFAULT 'ARS';
  END IF;
END $$;

-- 3) Add unique constraint to performance_daily to prevent duplicates
-- Using a unique index since we have nullable entity_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_performance_daily_unique 
  ON public.performance_daily (workspace_id, account_id, provider, entity_type, date, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid));
