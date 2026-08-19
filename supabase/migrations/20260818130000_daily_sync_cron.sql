-- ─────────────────────────────────────────────────────────────────────────────
-- Sync diario automático.
--
-- Reemplaza el proceso manual (abrir sesión, consultar el MCP a mano, generar
-- SQL, cargarlo). Corre solo todos los días, sin intervención.
--
-- Requiere el secreto 'service_role_key' en Vault.
-- Horarios en UTC; Argentina es UTC-3.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trigger_sync_function(p_function_name text, p_days_back int DEFAULT 3)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_key text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Falta el secreto service_role_key en Vault';
  END IF;

  SELECT net.http_post(
    url     := 'https://etuycbadcpchdsrpeyxr.supabase.co/functions/v1/' || p_function_name,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key),
    body    := jsonb_build_object(
                 'workspace_id', 'a0000000-0000-0000-0000-000000000001',
                 'days_back',    p_days_back,
                 'triggered_by', 'cron'),
    timeout_milliseconds := 240000
  ) INTO v_request_id;

  RETURN v_request_id;
END $fn$;

-- Reimputa los últimos días. Barato e idempotente: recalcular no duplica.
CREATE OR REPLACE FUNCTION public.cron_apply_client_mapping()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  PERFORM public.apply_client_mapping(
    'a0000000-0000-0000-0000-000000000001'::uuid,
    (current_date - 10)::date,
    current_date);
END $fn$;

-- ── Programación ────────────────────────────────────────────────────────────
-- 09:00 UTC = 06:00 ART. A esa hora las plataformas ya cerraron el día anterior.
SELECT cron.unschedule('sync-meta-daily')      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='sync-meta-daily');
SELECT cron.unschedule('sync-google-daily')    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='sync-google-daily');
SELECT cron.unschedule('apply-client-mapping') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='apply-client-mapping');

SELECT cron.schedule('sync-meta-daily',   '0 9 * * *',  $$SELECT public.trigger_sync_function('sync-meta-daily', 3)$$);
SELECT cron.schedule('sync-google-daily', '10 9 * * *', $$SELECT public.trigger_sync_function('sync-google-daily', 3)$$);
-- 30 min de margen para que ambos syncs terminen de escribir.
SELECT cron.schedule('apply-client-mapping', '40 9 * * *', $$SELECT public.cron_apply_client_mapping()$$);

-- ── GA4 ─────────────────────────────────────────────────────────────────────
-- La property mapea directo al cliente: no hay nombres de campaña de por medio.
CREATE OR REPLACE FUNCTION public.apply_ga4_client_mapping(
  p_workspace_id uuid, p_since date, p_until date
) RETURNS TABLE (mapped bigint, unmapped bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_mapped bigint; v_unmapped bigint;
BEGIN
  WITH upd AS (
    UPDATE public.ga4_daily g
    SET client_id = public.resolve_client_for_campaign(
          g.workspace_id, 'ga4'::public.integration_provider, a.external_account_id, '')
    FROM public.accounts a
    WHERE g.account_id = a.id
      AND g.workspace_id = p_workspace_id
      AND g.date BETWEEN p_since AND p_until
    RETURNING g.client_id AS cid
  )
  SELECT count(*) FILTER (WHERE cid IS NOT NULL),
         count(*) FILTER (WHERE cid IS NULL)
    INTO v_mapped, v_unmapped FROM upd;
  RETURN QUERY SELECT v_mapped, v_unmapped;
END $fn$;

CREATE OR REPLACE FUNCTION public.cron_apply_client_mapping()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  PERFORM public.apply_client_mapping(
    'a0000000-0000-0000-0000-000000000001'::uuid, (current_date - 10)::date, current_date);
  PERFORM public.apply_ga4_client_mapping(
    'a0000000-0000-0000-0000-000000000001'::uuid, (current_date - 10)::date, current_date);
END $fn$;

SELECT cron.unschedule('sync-ga4-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='sync-ga4-daily');
SELECT cron.schedule('sync-ga4-daily', '20 9 * * *', $$SELECT public.trigger_sync_function('sync-ga4-daily', 3)$$);
