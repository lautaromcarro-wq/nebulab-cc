-- La tabla de respaldo del histórico prorrateado se creó con CREATE TABLE AS,
-- que no hereda RLS. Quedó siendo la única tabla legible con la anon key, que
-- es pública por diseño y viaja en el bundle del frontend.
ALTER TABLE public.performance_daily_backup_20260818 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pdb_member_read ON public.performance_daily_backup_20260818;
CREATE POLICY pdb_member_read ON public.performance_daily_backup_20260818
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
