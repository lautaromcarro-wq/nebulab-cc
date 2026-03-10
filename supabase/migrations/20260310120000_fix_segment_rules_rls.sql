-- Fix segment_rules RLS: allow analyst role to manage rules (not just admin)
-- Also fix balance_loads and client_invoices visibility for finance role

-- segment_rules: analysts need to create/edit/delete rules
DROP POLICY IF EXISTS "Admin insert segment_rules" ON public.segment_rules;
DROP POLICY IF EXISTS "Admin update segment_rules" ON public.segment_rules;
DROP POLICY IF EXISTS "Admin delete segment_rules" ON public.segment_rules;

CREATE POLICY "Analyst+ insert segment_rules" ON public.segment_rules
  FOR INSERT TO authenticated
  WITH CHECK (
    is_workspace_member(auth.uid(), workspace_id)
    AND get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst')
  );

CREATE POLICY "Analyst+ update segment_rules" ON public.segment_rules
  FOR UPDATE TO authenticated
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst')
  );

CREATE POLICY "Analyst+ delete segment_rules" ON public.segment_rules
  FOR DELETE TO authenticated
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst')
  );

-- segments table: same fix (only admin could insert/update/delete)
DROP POLICY IF EXISTS "Admin insert segments" ON public.segments;
DROP POLICY IF EXISTS "Admin update segments" ON public.segments;
DROP POLICY IF EXISTS "Admin delete segments" ON public.segments;

CREATE POLICY "Analyst+ insert segments" ON public.segments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_workspace_member(auth.uid(), workspace_id)
    AND get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst')
  );

CREATE POLICY "Analyst+ update segments" ON public.segments
  FOR UPDATE TO authenticated
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst')
  );

CREATE POLICY "Analyst+ delete segments" ON public.segments
  FOR DELETE TO authenticated
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'analyst')
  );

-- balance_loads and client_invoices: only admin role (finanzas)
-- These tables were created with is_workspace_member — restrict to admin only
DROP POLICY IF EXISTS "workspace_member_balance_loads" ON public.balance_loads;
DROP POLICY IF EXISTS "workspace_member_invoices" ON public.client_invoices;

CREATE POLICY "Admin only balance_loads" ON public.balance_loads
  FOR ALL TO authenticated
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND get_workspace_role(auth.uid(), workspace_id) = 'admin'
  );

CREATE POLICY "Admin only client_invoices" ON public.client_invoices
  FOR ALL TO authenticated
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND get_workspace_role(auth.uid(), workspace_id) = 'admin'
  );
