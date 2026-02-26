
-- GA4 daily revenue table
CREATE TABLE public.ga4_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  date date NOT NULL,
  revenue numeric NOT NULL DEFAULT 0,
  purchases bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, date)
);

ALTER TABLE public.ga4_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see ga4_daily" ON public.ga4_daily FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

-- GA4 daily by source/medium
CREATE TABLE public.ga4_by_source (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  date date NOT NULL,
  source text NOT NULL DEFAULT '(direct)',
  medium text NOT NULL DEFAULT '(none)',
  revenue numeric NOT NULL DEFAULT 0,
  purchases bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, date, source, medium)
);

ALTER TABLE public.ga4_by_source ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see ga4_by_source" ON public.ga4_by_source FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

-- Triggers for updated_at
CREATE TRIGGER update_ga4_daily_updated_at
  BEFORE UPDATE ON public.ga4_daily
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ga4_by_source_updated_at
  BEFORE UPDATE ON public.ga4_by_source
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
