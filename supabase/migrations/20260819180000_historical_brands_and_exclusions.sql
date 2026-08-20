-- ─────────────────────────────────────────────────────────────────────────────
-- El histórico de Meta viene de líneas de crédito prestadas por un socio, así
-- que las cuentas tienen campañas de anunciantes anteriores mezcladas con las
-- nuestras. Sin estas reglas, los defaults por cuenta se las imputarían a
-- clientes que nunca hicieron esa inversión.
-- ─────────────────────────────────────────────────────────────────────────────

-- Ex clientes: Nebulab manejó Leatherman y Doite (marcas de Angel Baraldo) y
-- hoy ya no. El histórico es real y les corresponde.
INSERT INTO public.clients (id, workspace_id, name, status, notes)
VALUES
  ('c0000011-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',
   'Leatherman','inactive','Marca de Angel Baraldo. Ex cliente de Nebulab.'),
  ('c0000012-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',
   'Doite','inactive','Marca de Angel Baraldo. Ex cliente de Nebulab.')
ON CONFLICT (id) DO NOTHING;

-- Properties GA4 de las dos, para tener ventas reales del período
INSERT INTO public.accounts (workspace_id, provider, external_account_id, name, currency, status)
VALUES
  ('a0000000-0000-0000-0000-000000000001','ga4','250013317','Leatherman GA4','ARS','active'),
  ('a0000000-0000-0000-0000-000000000001','ga4','353974006','Doite GA4',      'ARS','active')
ON CONFLICT (workspace_id, provider, external_account_id) DO NOTHING;

INSERT INTO public.workspace_account_settings
  (workspace_id, provider, external_id, account_name, is_enabled)
VALUES
  ('a0000000-0000-0000-0000-000000000001','ga4','250013317','Leatherman', true),
  ('a0000000-0000-0000-0000-000000000001','ga4','353974006','Doite',      true)
ON CONFLICT (workspace_id, provider, external_id)
DO UPDATE SET is_enabled = EXCLUDED.is_enabled;

-- ── Exclusiones: anunciante anterior de la línea de crédito de Baraldo ──────
-- Electrónica de consumo, nada que ver con las marcas que maneja Nebulab.
INSERT INTO public.client_campaign_rules
  (workspace_id, client_id, provider, external_account_id, match_type, pattern, priority, is_exclusion, notes)
SELECT 'a0000000-0000-0000-0000-000000000001', NULL, NULL, NULL, 'contains', v.pat, 10, true,
       'Anunciante anterior de la LC de Baraldo'
FROM (VALUES
  ('APPLE'), ('IPHONE'), ('MACBOOK'), ('SAMSUNG'), ('GALAXY'),
  ('LOGITECH'), ('15 PRO MAX'), ('TOFU C LU'), ('7_BOF_RECONTACTO')
) AS v(pat)
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_campaign_rules r
  WHERE r.workspace_id = 'a0000000-0000-0000-0000-000000000001' AND r.pattern = v.pat);

-- ── Marcas históricas y unidades de ABstract ────────────────────────────────
-- LaneKeeper fue un SaaS discontinuado y SLA Summit un evento propio: los dos
-- son inversión de ABstract, no de un cliente.
INSERT INTO public.client_campaign_rules
  (workspace_id, client_id, provider, external_account_id, match_type, pattern, priority, notes)
SELECT 'a0000000-0000-0000-0000-000000000001', c.id, NULL, NULL, 'contains', v.pat, 20, v.note
FROM (VALUES
  ('LEATHERMAN','Leatherman', 'Ex cliente'),
  ('DOITE',     'Doite',      'Ex cliente'),
  ('LANEKEEPER','ABstract',   'SaaS propio discontinuado'),
  ('SLA_SUMMIT','ABstract',   'Evento logístico propio')
) AS v(pat, cname, note)
JOIN public.clients c ON c.workspace_id = 'a0000000-0000-0000-0000-000000000001' AND c.name = v.cname
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_campaign_rules r
  WHERE r.workspace_id = c.workspace_id AND r.pattern = v.pat);

-- GA4 de los ex clientes
INSERT INTO public.client_campaign_rules
  (workspace_id, client_id, provider, external_account_id, match_type, pattern, priority, notes)
SELECT 'a0000000-0000-0000-0000-000000000001', c.id, 'ga4'::public.integration_provider,
       v.pid, 'account_default', '', 90, 'Property del ex cliente'
FROM (VALUES ('250013317','Leatherman'), ('353974006','Doite')) AS v(pid, cname)
JOIN public.clients c ON c.workspace_id = 'a0000000-0000-0000-0000-000000000001' AND c.name = v.cname
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_campaign_rules r
  WHERE r.workspace_id = c.workspace_id AND r.external_account_id = v.pid);
