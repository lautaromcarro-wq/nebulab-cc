-- ─────────────────────────────────────────────────────────────────────────────
-- Mapeo campaña → cliente para el sync automático.
--
-- Contexto: las edge functions de sync escriben performance_daily con
-- entity_type 'account' y 'campaign', pero nunca setean client_id, que es por
-- donde agrupa el dashboard. Esto resuelve la atribución después del sync, sin
-- tocar las functions.
--
-- Regla de oro contra el doble conteo: SOLO las filas entity_type='campaign'
-- llevan client_id. Las de 'account' quedan en NULL para no sumar dos veces la
-- misma plata (el total de cuenta ya está contenido en sus campañas).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.client_campaign_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  -- NULL + is_exclusion = la campaña se descarta a propósito (interno, personal)
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  provider public.integration_provider,   -- NULL = cualquier plataforma
  external_account_id text,               -- NULL = cualquier cuenta
  match_type text NOT NULL DEFAULT 'contains'
    CHECK (match_type IN ('contains','starts_with','regex','exact','account_default')),
  pattern text NOT NULL DEFAULT '',
  priority int NOT NULL DEFAULT 100,      -- menor gana; primera coincidencia corta
  is_exclusion boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccr_lookup
  ON public.client_campaign_rules(workspace_id, priority);

ALTER TABLE public.client_campaign_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ccr_member_read ON public.client_campaign_rules;
CREATE POLICY ccr_member_read ON public.client_campaign_rules
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

-- ── Resolución: devuelve el cliente de una campaña, o NULL ───────────────────
-- NULL significa "no imputar a nadie": puede ser una exclusión deliberada o que
-- ninguna regla matcheó. Lo segundo se audita con unmapped_campaign_spend.

CREATE OR REPLACE FUNCTION public.resolve_client_for_campaign(
  p_workspace_id uuid,
  p_provider public.integration_provider,
  p_external_account_id text,
  p_campaign_name text
) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  r RECORD;
  hit boolean;
BEGIN
  FOR r IN
    SELECT * FROM public.client_campaign_rules
    WHERE workspace_id = p_workspace_id
      AND (provider IS NULL OR provider = p_provider)
      AND (external_account_id IS NULL OR external_account_id = p_external_account_id)
    ORDER BY priority ASC, id ASC
  LOOP
    IF r.match_type = 'contains' THEN
      hit := p_campaign_name ILIKE '%' || r.pattern || '%';
    ELSIF r.match_type = 'starts_with' THEN
      hit := p_campaign_name ILIKE r.pattern || '%';
    ELSIF r.match_type = 'exact' THEN
      hit := lower(p_campaign_name) = lower(r.pattern);
    ELSIF r.match_type = 'regex' THEN
      hit := p_campaign_name ~* r.pattern;
    ELSIF r.match_type = 'account_default' THEN
      hit := true;
    ELSE
      hit := false;
    END IF;

    IF hit THEN
      IF r.is_exclusion THEN
        RETURN NULL;
      END IF;
      RETURN r.client_id;
    END IF;
  END LOOP;
  RETURN NULL;
END
$fn$;

CREATE OR REPLACE FUNCTION public.apply_client_mapping(
  p_workspace_id uuid,
  p_since date,
  p_until date
) RETURNS TABLE (mapped bigint, unmapped bigint, account_rows_cleared bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_mapped bigint;
  v_unmapped bigint;
  v_cleared bigint;
BEGIN
  WITH upd AS (
    UPDATE public.performance_daily pd
    SET client_id = public.resolve_client_for_campaign(
          pd.workspace_id, pd.provider, a.external_account_id, c.name)
    FROM public.campaigns c, public.accounts a
    WHERE pd.entity_type = 'campaign'
      AND pd.entity_id   = c.id
      AND pd.account_id  = a.id
      AND pd.workspace_id = p_workspace_id
      AND pd.date BETWEEN p_since AND p_until
    RETURNING pd.client_id AS cid
  )
  SELECT count(*) FILTER (WHERE cid IS NOT NULL),
         count(*) FILTER (WHERE cid IS NULL)
    INTO v_mapped, v_unmapped
  FROM upd;

  WITH clr AS (
    UPDATE public.performance_daily
    SET client_id = NULL
    WHERE entity_type = 'account'
      AND workspace_id = p_workspace_id
      AND date BETWEEN p_since AND p_until
      AND client_id IS NOT NULL
    RETURNING 1 AS one
  )
  SELECT count(*) INTO v_cleared FROM clr;

  RETURN QUERY SELECT v_mapped, v_unmapped, v_cleared;
END
$fn$;

CREATE OR REPLACE VIEW public.unmapped_campaign_spend AS
SELECT pd.workspace_id, pd.provider, a.external_account_id,
       c.name AS campaign_name, sum(pd.spend) AS spend,
       min(pd.date) AS first_date, max(pd.date) AS last_date
FROM public.performance_daily pd
JOIN public.campaigns c ON c.id = pd.entity_id
JOIN public.accounts  a ON a.id = pd.account_id
WHERE pd.entity_type = 'campaign' AND pd.client_id IS NULL AND pd.spend > 0
GROUP BY 1,2,3,4
ORDER BY spend DESC;
