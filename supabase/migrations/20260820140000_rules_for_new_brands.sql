-- SLA Summit y Nexo ahora son marcas con entidad propia: sus campañas dejan de
-- imputarse al padre (ABstract e InfoAuto) y pasan a la marca. El consolidado
-- del cliente las sigue incluyendo vía la jerarquía.
UPDATE public.client_campaign_rules r
SET client_id = (SELECT id FROM public.clients
                 WHERE workspace_id = r.workspace_id AND name = 'SLA Summit'),
    notes = 'Evento propio de ABstract'
WHERE r.workspace_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.pattern = 'SLA_SUMMIT';

-- En Google la campaña se llama SLA_DISPLAY, así que el patrón se acorta a SLA_
UPDATE public.client_campaign_rules
SET pattern = 'SLA_'
WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'
  AND pattern = 'SLA_SUMMIT';

UPDATE public.client_campaign_rules r
SET client_id = (SELECT id FROM public.clients
                 WHERE workspace_id = r.workspace_id AND name = 'Nexo'),
    notes = 'Unidad de negocio dentro de InfoAuto'
WHERE r.workspace_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.pattern = 'NEXO';
