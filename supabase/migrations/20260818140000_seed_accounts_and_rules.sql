DO $seed$
DECLARE ws uuid := 'a0000000-0000-0000-0000-000000000001';
BEGIN

-- ── Nebulab como unidad de negocio de ABstract ──────────────────────────────
INSERT INTO public.clients (id, workspace_id, name, status, notes)
VALUES ('c0000009-0000-0000-0000-000000000001', ws, 'Nebulab', 'active',
        'Unidad de negocio de ABstract. Inversión propia de adquisición.')
ON CONFLICT (id) DO NOTHING;

-- ── Cuentas REALES de Meta (las que la Graph API reconoce) ──────────────────
INSERT INTO public.accounts (workspace_id, provider, external_account_id, name, currency, status)
VALUES
  (ws,'meta','508337272928554',  'Angel Baraldo (multimarca)','ARS','active'),
  (ws,'meta','601990446054801',  'ABstract Solutions',        'ARS','active')
ON CONFLICT (workspace_id, provider, external_account_id) DO NOTHING;

-- ── Las 4 cuentas virtuales de Baraldo quedan fuera del sync ────────────────
-- No se borran: el histórico de 3.355 filas las referencia por FK.
UPDATE public.accounts SET status = 'disabled'
WHERE workspace_id = ws AND external_account_id LIKE '508337272928554-%';

-- ── Allowlist: sólo esto se sincroniza. Todo lo demás queda afuera. ─────────
INSERT INTO public.workspace_account_settings
  (workspace_id, provider, external_id, account_name, is_enabled)
VALUES
  (ws,'meta','508337272928554',  'Angel Baraldo (multimarca)', true),
  (ws,'meta','601990446054801',  'ABstract Solutions',         true),
  (ws,'meta','24619210131043369','Nebulads (InfoAuto)',        true),
  (ws,'meta','1452087459737264', 'Grupo MF',                   true),
  (ws,'google_ads','4409440076','Casabutik',  true),
  (ws,'google_ads','2734885054','Trento',     true),
  (ws,'google_ads','5993150372','Spinit',     true),
  (ws,'google_ads','4415704080','Diana',      true),
  (ws,'google_ads','9242696623','Grupo MF',   true),
  (ws,'google_ads','7034968555','Infoauto',   true)
ON CONFLICT (workspace_id, provider, external_id)
DO UPDATE SET is_enabled = EXCLUDED.is_enabled, account_name = EXCLUDED.account_name;

-- ── Reglas de mapeo campaña → cliente ──────────────────────────────────────
DELETE FROM public.client_campaign_rules WHERE workspace_id = ws;

-- Prioridad 10: exclusiones (se evalúan primero y cortan)
INSERT INTO public.client_campaign_rules
  (workspace_id, client_id, provider, external_account_id, match_type, pattern, priority, is_exclusion, notes)
VALUES
  (ws, NULL, NULL, NULL, 'contains','MASTERMETRICS', 10, true,
   'Producto personal de Lautaro, fuera del command center');

-- Prioridad 20: marca en el nombre de la campaña
INSERT INTO public.client_campaign_rules
  (workspace_id, client_id, provider, external_account_id, match_type, pattern, priority, notes)
SELECT ws, c.id, NULL, NULL, 'contains', v.pat, 20, v.note
FROM (VALUES
  ('CASABUTIK','Casabutik', NULL),
  ('DIANA',    'Diana',     NULL),
  ('SPINIT',   'Spinit',    NULL),
  ('TRENTO',   'Trento',    NULL),
  ('SHILBA',   'Shilba',    NULL),
  ('AURORA',   'Aurora',    'Unidad de negocio de ABstract'),
  ('NEBULAB',  'Nebulab',   'Unidad de negocio de ABstract'),
  ('GRUPOMF',  'Grupo MF',  NULL),
  ('GRUPO MF', 'Grupo MF',  NULL),
  ('NEXO',     'Infoauto',  'Nexo: unidad de negocio dentro de InfoAuto'),
  ('INFOAUTO', 'Infoauto',  NULL)
) AS v(pat, cname, note)
JOIN public.clients c ON c.workspace_id = ws AND c.name = v.cname;

-- Prioridad 90: default por cuenta, para lo que no matcheó arriba
INSERT INTO public.client_campaign_rules
  (workspace_id, client_id, provider, external_account_id, match_type, pattern, priority, notes)
SELECT ws, c.id, v.prov::public.integration_provider, v.acct, 'account_default', '', 90, v.note
FROM (VALUES
  ('meta',      '24619210131043369','Infoauto', 'Cuenta Nebulads: default InfoAuto (cubre AB_PRTOP_COM_TN_REVISTA)'),
  ('meta',      '1452087459737264', 'Grupo MF', 'Cuenta monomarca'),
  ('google_ads','4409440076','Casabutik', 'Cuenta Google monomarca'),
  ('google_ads','2734885054','Trento',    'Cuenta Google monomarca'),
  ('google_ads','5993150372','Spinit',    'Cuenta Google monomarca'),
  ('google_ads','4415704080','Diana',     'Cuenta Google monomarca'),
  ('google_ads','9242696623','Grupo MF',  'Cuenta Google monomarca'),
  ('google_ads','7034968555','Infoauto',  'Cuenta Google monomarca')
) AS v(prov, acct, cname, note)
JOIN public.clients c ON c.workspace_id = ws AND c.name = v.cname;

END $seed$;
DO $g$
DECLARE ws uuid := 'a0000000-0000-0000-0000-000000000001';
BEGIN

-- Properties GA4 vivas, verificadas por tráfico real en los últimos 30 días.
INSERT INTO public.accounts (workspace_id, provider, external_account_id, name, currency, status)
VALUES
  (ws,'ga4','491663609','Casa Butik GA4',   'ARS','active'),
  (ws,'ga4','309434647','Diana Web GA4',    'ARS','active'),
  (ws,'ga4','302737191','Spinit GA4',       'ARS','active'),
  (ws,'ga4','353975971','Trento GA4',       'ARS','active'),
  (ws,'ga4','526136865','Grupo MF GA4',     'ARS','active'),
  (ws,'ga4','388425579','Infoauto GA4',     'ARS','active'),
  (ws,'ga4','487464833','InfoAuto TN GA4',  'ARS','active'),
  (ws,'ga4','536129454','Aurora Suite GA4', 'ARS','active')
ON CONFLICT (workspace_id, provider, external_account_id) DO NOTHING;

INSERT INTO public.workspace_account_settings
  (workspace_id, provider, external_id, account_name, is_enabled)
VALUES
  (ws,'ga4','491663609','Casa Butik',   true),
  (ws,'ga4','309434647','Diana Web',    true),
  (ws,'ga4','302737191','Spinit',       true),
  (ws,'ga4','353975971','Trento',       true),
  (ws,'ga4','526136865','Grupo MF',     true),
  (ws,'ga4','388425579','Infoauto',     true),
  (ws,'ga4','487464833','InfoAuto TN',  true),
  (ws,'ga4','536129454','Aurora Suite', true)
ON CONFLICT (workspace_id, provider, external_id)
DO UPDATE SET is_enabled = EXCLUDED.is_enabled, account_name = EXCLUDED.account_name;

-- Property → cliente. En GA4 es 1 a 1, sin nombres de campaña de por medio.
DELETE FROM public.client_campaign_rules WHERE workspace_id = ws AND provider = 'ga4';
INSERT INTO public.client_campaign_rules
  (workspace_id, client_id, provider, external_account_id, match_type, pattern, priority, notes)
SELECT ws, c.id, 'ga4'::public.integration_provider, v.pid, 'account_default', '', 90, v.note
FROM (VALUES
  ('491663609','Casabutik', NULL),
  ('309434647','Diana',     NULL),
  ('302737191','Spinit',    NULL),
  ('353975971','Trento',    NULL),
  ('526136865','Grupo MF',  NULL),
  ('388425579','Infoauto',  'Property principal: 200k sesiones/30d'),
  ('487464833','Infoauto',  'Tiendanube de InfoAuto'),
  ('536129454','Aurora',    'Web de Aurora, reemplaza el lead gen de ABstract')
) AS v(pid, cname, note)
JOIN public.clients c ON c.workspace_id = ws AND c.name = v.cname;

END $g$;
