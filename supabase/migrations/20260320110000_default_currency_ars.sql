-- Set ARS as the default currency for all relevant tables
-- and migrate existing USD records to ARS

ALTER TABLE public.workspaces    ALTER COLUMN currency SET DEFAULT 'ARS';
ALTER TABLE public.segments      ALTER COLUMN currency SET DEFAULT 'ARS';
ALTER TABLE public.segment_daily ALTER COLUMN currency SET DEFAULT 'ARS';

UPDATE public.workspaces    SET currency = 'ARS' WHERE currency = 'USD';
UPDATE public.segments      SET currency = 'ARS' WHERE currency = 'USD';
UPDATE public.segment_daily SET currency = 'ARS' WHERE currency = 'USD';
