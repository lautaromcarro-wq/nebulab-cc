-- Add group_id to segment_rules for AND logic
-- Rules sharing the same group_id must ALL match (AND).
-- Different groups are OR'd together.
ALTER TABLE public.segment_rules
ADD COLUMN group_id uuid NOT NULL DEFAULT gen_random_uuid();

-- Backfill: each existing rule gets its own unique group_id (already handled by DEFAULT)
-- Add index for efficient grouping
CREATE INDEX idx_segment_rules_group_id ON public.segment_rules (group_id);