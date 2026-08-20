-- La cuenta de Google de ABstract es multimarca: tiene campañas de Aurora,
-- Nebulab y de la propia ABstract (SLA Summit, LaneKeeper, branding). Las dos
-- primeras las capturan las reglas por nombre; el resto necesitaba un default.
INSERT INTO public.client_campaign_rules
  (workspace_id, client_id, provider, external_account_id, match_type, pattern, priority, notes)
SELECT 'a0000000-0000-0000-0000-000000000001', c.id,
       'google_ads'::public.integration_provider, '3150054115', 'account_default', '', 95,
       'Resto de la cuenta de ABstract, después de Aurora y Nebulab'
FROM public.clients c
WHERE c.workspace_id = 'a0000000-0000-0000-0000-000000000001' AND c.name = 'ABstract'
  AND NOT EXISTS (
    SELECT 1 FROM public.client_campaign_rules r
    WHERE r.workspace_id = c.workspace_id AND r.external_account_id = '3150054115'
      AND r.match_type = 'account_default');

-- La vista mezclaba dos cosas distintas: campañas que ninguna regla clasificó
-- (que hay que revisar) y campañas excluidas a propósito, como las del
-- anunciante anterior de la línea de crédito. Sólo las primeras son un problema.
CREATE OR REPLACE VIEW public.unmapped_campaign_spend AS
SELECT pd.workspace_id, pd.provider, a.external_account_id,
       c.name AS campaign_name, sum(pd.spend) AS spend,
       min(pd.date) AS first_date, max(pd.date) AS last_date
FROM public.performance_daily pd
JOIN public.campaigns c ON c.id = pd.entity_id
JOIN public.accounts  a ON a.id = pd.account_id
WHERE pd.entity_type = 'campaign' AND pd.client_id IS NULL AND pd.spend > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.client_campaign_rules r
    WHERE r.workspace_id = pd.workspace_id
      AND r.is_exclusion
      AND c.name ILIKE '%' || r.pattern || '%')
GROUP BY 1,2,3,4
ORDER BY spend DESC;
