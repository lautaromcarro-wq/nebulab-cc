-- ─────────────────────────────────────────────────────────────────────────────
-- Experiments: nuevos campos para flujo completo de medición + IA
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE experiments
  ADD COLUMN IF NOT EXISTS platform      text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS description   text,
  ADD COLUMN IF NOT EXISTS baseline_value numeric(14,4),
  ADD COLUMN IF NOT EXISTS final_value   numeric(14,4),
  ADD COLUMN IF NOT EXISTS ai_insight    text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Finance costs: categoría de producto para share de vertical (COGS)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE finance_costs
  ADD COLUMN IF NOT EXISTS product_category text,
  ADD COLUMN IF NOT EXISTS client_id        uuid REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS finance_costs_client_id_idx ON finance_costs(client_id);
