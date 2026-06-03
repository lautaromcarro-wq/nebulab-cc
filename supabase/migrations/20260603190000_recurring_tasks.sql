-- Recurring tasks system for Nebulab analyst workflows
-- Templates define what needs to be done; instances are generated per client per period.

-- ── Task Templates ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL,          -- 'google_ads', 'meta_ads', 'analytics', 'general'
  frequency text NOT NULL,         -- 'weekly', 'biweekly', 'monthly'
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage task_templates" ON public.task_templates FOR ALL TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

-- ── Client Task Config ──────────────────────────────────────────────────────
-- Which templates apply to which client (some clients don't have Google, etc.)

CREATE TABLE IF NOT EXISTS public.client_task_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT true,
  assigned_to text,               -- analyst name (e.g. "Jazmin Leiva")
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, template_id)
);

ALTER TABLE public.client_task_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage client_task_config" ON public.client_task_config FOR ALL TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

-- ── Task Instances ──────────────────────────────────────────────────────────
-- Concrete tasks generated per client per period. Auto-renew on completion.

CREATE TABLE IF NOT EXISTS public.task_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.task_templates(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL,
  frequency text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- 'pending', 'done', 'skipped'
  completed_at timestamptz,
  completed_by text,              -- analyst name
  note text,                      -- note left when completing
  bitacora_id uuid REFERENCES public.client_bitacora(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, template_id, period_start)
);

CREATE INDEX idx_task_instances_client_period
  ON public.task_instances (client_id, period_start, period_end);

CREATE INDEX idx_task_instances_status
  ON public.task_instances (workspace_id, status);

ALTER TABLE public.task_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage task_instances" ON public.task_instances FOR ALL TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

-- ── Add type to client_bitacora if not exists ───────────────────────────────
-- We want 'task_completion' as a valid type alongside 'nota', 'cambio', etc.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_bitacora' AND column_name = 'task_instance_id'
  ) THEN
    ALTER TABLE public.client_bitacora ADD COLUMN task_instance_id uuid REFERENCES public.task_instances(id) ON DELETE SET NULL;
  END IF;
END $$;
