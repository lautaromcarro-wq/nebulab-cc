-- ─────────────────────────────────────────────────────────────────────────────
-- Bootstrap: workspace, clientes y cuentas.
--
-- Esto se había creado a mano en junio 2026 y nunca quedó versionado, así que
-- al reconstruir el proyecto las migraciones de seed fallaban por FK: los
-- clientes referenciaban un workspace inexistente.
--
-- Los UUID son fijos a propósito: el histórico generado por los scripts de
-- scripts/ los referencia literalmente.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.workspaces (id, name, timezone, currency)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Nebulab',
        'America/Argentina/Buenos_Aires', 'ARS')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clients (id, workspace_id, name, status)
VALUES
  ('c0000001-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Diana',    'active'),
  ('c0000002-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Spinit',   'active'),
  ('c0000003-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Casabutik','active'),
  ('c0000004-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Trento',   'active'),
  ('c0000005-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Shilba',   'active'),
  ('c0000006-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Infoauto', 'active'),
  ('c0000007-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Grupo MF', 'active'),
  ('c0000008-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Aurora',   'active')
ON CONFLICT (id) DO NOTHING;

-- Cuentas de anuncios. Los IDs externos son los reales de cada API: es lo que
-- las edge functions le piden a Meta y a Google.
INSERT INTO public.accounts (workspace_id, provider, external_account_id, name, currency, status)
VALUES
  ('a0000000-0000-0000-0000-000000000001','meta','24619210131043369','Nebulads (InfoAuto)','ARS','active'),
  ('a0000000-0000-0000-0000-000000000001','meta','1452087459737264', 'Grupo MF Meta',      'ARS','active'),
  ('a0000000-0000-0000-0000-000000000001','google_ads','4409440076','Casabutik Google','ARS','active'),
  ('a0000000-0000-0000-0000-000000000001','google_ads','2734885054','Trento Google',   'ARS','active'),
  ('a0000000-0000-0000-0000-000000000001','google_ads','5993150372','Spinit Google',   'ARS','active'),
  ('a0000000-0000-0000-0000-000000000001','google_ads','4415704080','Diana Google',    'ARS','active'),
  ('a0000000-0000-0000-0000-000000000001','google_ads','9242696623','Grupo MF Google', 'ARS','active'),
  ('a0000000-0000-0000-0000-000000000001','google_ads','7034968555','Infoauto Google', 'ARS','active')
ON CONFLICT (workspace_id, provider, external_account_id) DO NOTHING;
