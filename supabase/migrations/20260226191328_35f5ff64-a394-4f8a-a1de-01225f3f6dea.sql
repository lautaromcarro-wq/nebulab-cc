
-- Financial settings per workspace for contribution margin
CREATE TABLE public.workspace_financial_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  avg_cogs_percent NUMERIC NOT NULL DEFAULT 0,
  shipping_percent NUMERIC NOT NULL DEFAULT 0,
  payment_fee_percent NUMERIC NOT NULL DEFAULT 0,
  refund_percent NUMERIC NOT NULL DEFAULT 0,
  iva_percent NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

ALTER TABLE public.workspace_financial_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view financial settings"
  ON public.workspace_financial_settings FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage financial settings"
  ON public.workspace_financial_settings FOR ALL
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- Workspace health snapshot
CREATE TABLE public.workspace_health (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'healthy',
  penalties JSONB NOT NULL DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id)
);

ALTER TABLE public.workspace_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace health"
  ON public.workspace_health FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Service can manage workspace health"
  ON public.workspace_health FOR ALL
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- Trigger for updated_at on financial settings
CREATE TRIGGER update_workspace_financial_settings_updated_at
  BEFORE UPDATE ON public.workspace_financial_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
