-- Add client_type to clients table for ecommerce vs lead_gen differentiation
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type TEXT NOT NULL DEFAULT 'ecommerce'
  CHECK (client_type IN ('ecommerce', 'lead_gen'));

-- Add comment
COMMENT ON COLUMN public.clients.client_type IS 'ecommerce or lead_gen — controls KPI display in Performance module';
