-- Add unique constraint for integration upsert (one integration per provider per workspace)
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_workspace_provider 
ON public.integrations (workspace_id, provider);
