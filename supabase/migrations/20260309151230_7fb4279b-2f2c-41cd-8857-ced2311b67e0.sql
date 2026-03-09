
-- 1. Columnas nuevas en clients (ya existen, IF NOT EXISTS las ignora)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS industria text,
  ADD COLUMN IF NOT EXISTS responsable_nebulab text,
  ADD COLUMN IF NOT EXISTS prioridad text DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS fecha_kickoff date,
  ADD COLUMN IF NOT EXISTS presupuesto_mensual_estimado numeric(12,2);

-- 2. Columnas nuevas en client_marca_info (tabla ya existe, agregar columnas faltantes)
ALTER TABLE client_marca_info
  ADD COLUMN IF NOT EXISTS historia text,
  ADD COLUMN IF NOT EXISTS propuesta_valor text,
  ADD COLUMN IF NOT EXISTS publico_objetivo text,
  ADD COLUMN IF NOT EXISTS tono_comunicacion text DEFAULT 'profesional',
  ADD COLUMN IF NOT EXISTS valores_marca text;

-- 3. Columnas nuevas en client_productos (tabla ya existe, agregar columnas faltantes)
ALTER TABLE client_productos
  ADD COLUMN IF NOT EXISTS nombre text,
  ADD COLUMN IF NOT EXISTS margen_percent numeric(5,2);

-- 4. Columnas nuevas en client_accesos (tabla ya existe, agregar columnas faltantes)
ALTER TABLE client_accesos
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS status_v2 text DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS notes text;

-- 5. Columnas nuevas en onboarding_checklist (tabla ya existe, agregar columnas faltantes)
ALTER TABLE onboarding_checklist
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS evidence_url text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- 6. Tabla de bitácora por cliente
CREATE TABLE IF NOT EXISTS client_bitacora (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'nota',
  title text,
  body text NOT NULL,
  author_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_bitacora_client_id_idx ON client_bitacora(client_id);

-- 7. Tabla de accionables por cliente
CREATE TABLE IF NOT EXISTS client_accionables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to text,
  due_date date,
  priority text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'pendiente',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_accionables_client_id_idx ON client_accionables(client_id);

-- 8. Tabla de cargas de saldo (Billing)
CREATE TABLE IF NOT EXISTS balance_loads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ARS',
  load_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pendiente',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS balance_loads_client_id_idx ON balance_loads(client_id);

-- 9. Tabla de facturas (Billing)
CREATE TABLE IF NOT EXISTS client_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invoice_number text,
  concept text,
  amount_net numeric(12,2),
  amount_total numeric(12,2),
  currency text NOT NULL DEFAULT 'ARS',
  period text,
  status text NOT NULL DEFAULT 'borrador',
  sent_at timestamptz,
  due_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_invoices_client_id_idx ON client_invoices(client_id);

-- 10. RLS en tablas nuevas
ALTER TABLE client_bitacora ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_accionables ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_invoices ENABLE ROW LEVEL SECURITY;

-- 11. Políticas RLS (DROP IF EXISTS para idempotencia)
DO $$ BEGIN
  DROP POLICY IF EXISTS "workspace_member_bitacora" ON client_bitacora;
  DROP POLICY IF EXISTS "workspace_member_accionables" ON client_accionables;
  DROP POLICY IF EXISTS "workspace_member_balance_loads" ON balance_loads;
  DROP POLICY IF EXISTS "workspace_member_invoices" ON client_invoices;
END $$;

CREATE POLICY "workspace_member_bitacora" ON client_bitacora FOR ALL
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "workspace_member_accionables" ON client_accionables FOR ALL
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "workspace_member_balance_loads" ON balance_loads FOR ALL
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "workspace_member_invoices" ON client_invoices FOR ALL
  USING (is_workspace_member(auth.uid(), workspace_id));
