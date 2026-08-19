-- Al reconstruir el proyecto los usuarios se pierden, y sin fila en
-- workspace_members RLS devuelve todo vacío: la app carga pero no muestra
-- nada, que parece un bug de datos y no un tema de permisos.
--
-- Este trigger da de alta como admin sólo a los emails de la allowlist. No es
-- "cualquiera que se registre entra": es una lista explícita.
CREATE OR REPLACE FUNCTION public.auto_add_allowlisted_member()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF lower(NEW.email) IN (
       'lcarro@abstractsolutions.com.ar',
       'lautaromcarro@gmail.com'
     ) THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
    VALUES ('a0000000-0000-0000-0000-000000000001', NEW.id, 'admin', 'active')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS on_auth_user_created_add_member ON auth.users;
CREATE TRIGGER on_auth_user_created_add_member
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_add_allowlisted_member();
