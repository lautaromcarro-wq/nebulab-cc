-- ABstract: cliente propio, cuenta de Google Ads (multimarca Aurora/Nebulab)
-- y property GA4 corporativa.

DO $a$
DECLARE ws uuid := 'a0000000-0000-0000-0000-000000000001';
BEGIN

-- ABstract como cliente propio: la web corporativa, distinta de sus dos
-- unidades de negocio (Aurora y Nebulab), que ya tienen entidad propia.
INSERT INTO public.clients (id, workspace_id, name, status, notes)
VALUES ('c0000010-0000-0000-0000-000000000001', ws, 'ABstract', 'active',
        'Web corporativa. El lead gen migró a Aurora, pero la property sigue convirtiendo.')
ON CONFLICT (id) DO NOTHING;

-- Cuenta de Google Ads de ABstract: multimarca (campañas de Aurora y Nebulab).
-- Sin account_default a propósito: las reglas por nombre ya las separan.
INSERT INTO public.accounts (workspace_id, provider, external_account_id, name, currency, status)
VALUES
  (ws,'google_ads','3150054115','ABstract Google Ads','ARS','active'),
  (ws,'ga4',       '364882575', 'ABstract GA4',       'ARS','active')
ON CONFLICT (workspace_id, provider, external_account_id) DO NOTHING;

INSERT INTO public.workspace_account_settings
  (workspace_id, provider, external_id, account_name, is_enabled)
VALUES
  (ws,'google_ads','3150054115','ABstract (Aurora + Nebulab)', true),
  (ws,'ga4',       '364882575', 'ABstract GA4',                true)
ON CONFLICT (workspace_id, provider, external_id)
DO UPDATE SET is_enabled = EXCLUDED.is_enabled, account_name = EXCLUDED.account_name;

-- La property GA4 corporativa va al cliente ABstract.
INSERT INTO public.client_campaign_rules
  (workspace_id, client_id, provider, external_account_id, match_type, pattern, priority, notes)
SELECT ws, c.id, 'ga4'::public.integration_provider, '364882575', 'account_default', '', 90,
       'Web corporativa de ABstract'
FROM public.clients c WHERE c.workspace_id = ws AND c.name = 'ABstract';

END $a$;

INSERT INTO public.client_campaign_rules
  (workspace_id, client_id, provider, external_account_id, match_type, pattern, priority, notes)
SELECT 'a0000000-0000-0000-0000-000000000001'::uuid, c.id, NULL, NULL, 'contains', 'ABSTRACT', 20,
       'Campañas de marca de ABstract'
FROM public.clients c
WHERE c.workspace_id = 'a0000000-0000-0000-0000-000000000001' AND c.name = 'ABstract'
  AND NOT EXISTS (SELECT 1 FROM public.client_campaign_rules r
                  WHERE r.workspace_id = c.workspace_id AND r.pattern = 'ABSTRACT');
