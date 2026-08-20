-- ─────────────────────────────────────────────────────────────────────────────
-- Cliente y marca.
--
-- Hasta ahora cada marca era un cliente suelto, y no había forma de preguntar
-- cuánto invierte Angel Baraldo, que es quien firma. El caso se repite en
-- ABstract (Aurora, Nebulab, SLA) y en InfoAuto (Nexo).
--
-- Se modela como jerarquía sobre la misma tabla en vez de separar en dos: las
-- marcas conservan su id, así las 48.000 filas de histórico y las 142
-- referencias del frontend siguen siendo válidas. El padre es el cliente
-- comercial; las hojas son las marcas.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS parent_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_parent
  ON public.clients(parent_client_id) WHERE parent_client_id IS NOT NULL;

-- Angel Baraldo: distribuidor oficial, marca paraguas de las siete
INSERT INTO public.clients (id, workspace_id, name, status, notes)
VALUES ('c0000020-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',
        'Angel Baraldo','active',
        'Distribuidor oficial. Marca paraguas. La inversión se concentra hoy en Diana y Casabutik.')
ON CONFLICT (id) DO NOTHING;

-- SLA Summit y Nexo pasan a ser marcas con entidad propia
INSERT INTO public.clients (id, workspace_id, name, status, notes)
VALUES
  ('c0000021-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',
   'SLA Summit','active','Evento logístico de ABstract. Se repite el año próximo.'),
  ('c0000022-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',
   'Nexo','active','Software desarrollado por Nexo. Unidad de negocio dentro de InfoAuto.')
ON CONFLICT (id) DO NOTHING;

-- ── Jerarquía ───────────────────────────────────────────────────────────────
UPDATE public.clients SET parent_client_id = 'c0000020-0000-0000-0000-000000000001'
WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'
  AND name IN ('Diana','Casabutik','Spinit','Shilba','Leatherman','Doite','Trento');

UPDATE public.clients SET parent_client_id = (
  SELECT id FROM public.clients
  WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND name = 'ABstract')
WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'
  AND name IN ('Aurora','Nebulab','SLA Summit');

UPDATE public.clients SET parent_client_id = (
  SELECT id FROM public.clients
  WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND name = 'Infoauto')
WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND name = 'Nexo';

-- ── Vista consolidada ───────────────────────────────────────────────────────
-- Devuelve, para cada marca, quién es su cliente comercial. Las que no tienen
-- padre son cliente y marca a la vez, como Grupo MF.
CREATE OR REPLACE VIEW public.client_rollup AS
SELECT c.id            AS brand_id,
       c.name          AS brand_name,
       COALESCE(p.id, c.id)     AS client_id,
       COALESCE(p.name, c.name) AS client_name,
       (c.parent_client_id IS NOT NULL) AS es_marca,
       c.workspace_id, c.status
FROM public.clients c
LEFT JOIN public.clients p ON p.id = c.parent_client_id;
