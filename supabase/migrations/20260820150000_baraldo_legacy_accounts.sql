-- ─────────────────────────────────────────────────────────────────────────────
-- Cuentas de Meta previas a la unificación en la línea de crédito de Baraldo.
--
-- Cada marca tenía su propia cuenta hasta may-2025, cuando se centralizó todo
-- en act_508337272928554. Sin estas cuentas faltaban 21 meses de inversión de
-- Meta: el histórico mostraba Google corriendo solo, que es imposible.
--
-- Nebulab trabaja estas marcas desde octubre 2024; lo anterior es inversión
-- del cliente con otra gestión, útil como contexto pero no como performance
-- propia.
-- ─────────────────────────────────────────────────────────────────────────────

-- Joseph Joseph no existía como marca en el sistema
INSERT INTO public.clients (id, workspace_id, name, status, notes, parent_client_id)
VALUES ('c0000013-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',
        'Joseph Joseph','active',
        'Marca de Angel Baraldo. Sin inversión dedicada desde la unificación de may-2025.',
        'c0000020-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.accounts (workspace_id, provider, external_account_id, name, currency, status)
VALUES
  ('a0000000-0000-0000-0000-000000000001','meta','783483985763596', 'Diana Deportes (legacy)','ARS','active'),
  ('a0000000-0000-0000-0000-000000000001','meta','2061762163984499','Spinit (legacy)',        'ARS','active'),
  ('a0000000-0000-0000-0000-000000000001','meta','287370902266069', 'Trento Gourmet (legacy)','ARS','active'),
  ('a0000000-0000-0000-0000-000000000001','meta','151019113008174', 'Joseph Joseph (legacy)', 'ARS','active'),
  ('a0000000-0000-0000-0000-000000000001','ga4', '353918780',       'Joseph Joseph GA4',      'ARS','active')
ON CONFLICT (workspace_id, provider, external_account_id) DO NOTHING;

INSERT INTO public.workspace_account_settings
  (workspace_id, provider, external_id, account_name, is_enabled)
VALUES
  ('a0000000-0000-0000-0000-000000000001','meta','783483985763596', 'Diana Deportes (legacy)',true),
  ('a0000000-0000-0000-0000-000000000001','meta','2061762163984499','Spinit (legacy)',        true),
  ('a0000000-0000-0000-0000-000000000001','meta','287370902266069', 'Trento Gourmet (legacy)',true),
  ('a0000000-0000-0000-0000-000000000001','meta','151019113008174', 'Joseph Joseph (legacy)', true),
  ('a0000000-0000-0000-0000-000000000001','ga4', '353918780',       'Joseph Joseph',          true)
ON CONFLICT (workspace_id, provider, external_id)
DO UPDATE SET is_enabled = EXCLUDED.is_enabled, account_name = EXCLUDED.account_name;

-- Son cuentas monomarca: todo lo que gastaron es de su marca.
INSERT INTO public.client_campaign_rules
  (workspace_id, client_id, provider, external_account_id, match_type, pattern, priority, notes)
SELECT 'a0000000-0000-0000-0000-000000000001', c.id,
       v.prov::public.integration_provider, v.acct, 'account_default', '', 92,
       'Cuenta propia de la marca, previa a la unificación de may-2025'
FROM (VALUES
  ('meta','783483985763596', 'Diana'),
  ('meta','2061762163984499','Spinit'),
  ('meta','287370902266069', 'Trento'),
  ('meta','151019113008174', 'Joseph Joseph'),
  ('ga4', '353918780',       'Joseph Joseph')
) AS v(prov, acct, cname)
JOIN public.clients c ON c.workspace_id='a0000000-0000-0000-0000-000000000001' AND c.name=v.cname
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_campaign_rules r
  WHERE r.workspace_id=c.workspace_id AND r.external_account_id=v.acct);
