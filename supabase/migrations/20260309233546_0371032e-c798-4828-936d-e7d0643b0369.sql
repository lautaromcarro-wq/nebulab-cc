
-- Experiments enhancements
ALTER TABLE experiments
  ADD COLUMN IF NOT EXISTS platform text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS baseline numeric,
  ADD COLUMN IF NOT EXISTS final_value numeric,
  ADD COLUMN IF NOT EXISTS variation_pct numeric,
  ADD COLUMN IF NOT EXISTS ai_insight text;

-- Finance enhancements
ALTER TABLE finance_costs
  ADD COLUMN IF NOT EXISTS product_category text;
