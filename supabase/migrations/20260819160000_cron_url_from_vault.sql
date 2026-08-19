-- La URL del proyecto estaba hardcodeada en trigger_sync_function. Al mover el
-- proyecto, el cron seguía apuntando al viejo y fallaba en silencio.
-- Ahora sale de Vault: cambiar de proyecto es cambiar un secreto.
CREATE OR REPLACE FUNCTION public.trigger_sync_function(p_function_name text, p_days_back int DEFAULT 3)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_key text;
  v_url text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'project_url';

  IF v_key IS NULL OR v_url IS NULL THEN
    RAISE EXCEPTION 'Faltan los secretos service_role_key o project_url en Vault';
  END IF;

  SELECT net.http_post(
    url     := v_url || '/functions/v1/' || p_function_name,
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
