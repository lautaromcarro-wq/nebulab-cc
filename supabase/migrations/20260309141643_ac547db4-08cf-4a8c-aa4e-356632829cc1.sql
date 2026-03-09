
-- 1. Campos nuevos en clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS industria text,
  ADD COLUMN IF NOT EXISTS responsable_nebulab text,
  ADD COLUMN IF NOT EXISTS prioridad text DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS fecha_kickoff date,
  ADD COLUMN IF NOT EXISTS presupuesto_mensual_estimado numeric(12,2);

-- 2. Onboarding Checklist
CREATE TABLE IF NOT EXISTS onboarding_checklist (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id       uuid NOT NULL REFERENCES clients(id)    ON DELETE CASCADE,
  categoria       text NOT NULL,
  item            text NOT NULL,
  prioridad       text NOT NULL DEFAULT 'media',
  estado          text NOT NULL DEFAULT 'pendiente',
  responsable     text NOT NULL DEFAULT 'nebulab',
  fecha_limite    date,
  evidencia_link  text,
  notas           text,
  orden           integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_checklist_client_id_idx ON onboarding_checklist(client_id);
CREATE INDEX IF NOT EXISTS onboarding_checklist_estado_idx    ON onboarding_checklist(estado);

ALTER TABLE onboarding_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members access onboarding_checklist"
  ON onboarding_checklist FOR ALL
  USING (is_workspace_member(auth.uid(), workspace_id));

-- 3. Accesos
CREATE TABLE IF NOT EXISTS client_accesos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id         uuid NOT NULL REFERENCES clients(id)    ON DELETE CASCADE,
  plataforma        text NOT NULL,
  tipo_acceso       text NOT NULL DEFAULT 'admin',
  email_destino     text,
  estado            text NOT NULL DEFAULT 'pendiente',
  fecha_solicitud   date,
  fecha_aprobacion  date,
  notas             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_accesos_client_id_idx ON client_accesos(client_id);

ALTER TABLE client_accesos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members access client_accesos"
  ON client_accesos FOR ALL
  USING (is_workspace_member(auth.uid(), workspace_id));

-- 4. Productos
CREATE TABLE IF NOT EXISTS client_productos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id             uuid NOT NULL REFERENCES clients(id)    ON DELETE CASCADE,
  sku                   text,
  nombre_producto       text NOT NULL,
  categoria             text,
  marca                 text,
  precio                numeric(12,2),
  costo                 numeric(12,2),
  margen_porcentaje     numeric(5,2),
  stock                 integer,
  rotacion              text DEFAULT 'media',
  producto_estrella     boolean DEFAULT false,
  producto_tactico      boolean DEFAULT false,
  producto_liquidacion  boolean DEFAULT false,
  notas                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_productos_client_id_idx ON client_productos(client_id);

ALTER TABLE client_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members access client_productos"
  ON client_productos FOR ALL
  USING (is_workspace_member(auth.uid(), workspace_id));

-- 5. Marca Info (1 fila por cliente)
CREATE TABLE IF NOT EXISTS client_marca_info (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id           uuid UNIQUE NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  historia_empresa    text,
  diferenciales       text,
  principales_clientes text,
  certificaciones     text,
  link_manual_marca   text,
  link_drive_activos  text,
  notas               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE client_marca_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members access client_marca_info"
  ON client_marca_info FOR ALL
  USING (is_workspace_member(auth.uid(), workspace_id));
