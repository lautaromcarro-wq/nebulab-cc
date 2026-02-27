
-- 1) Add account_id to ga4_daily
ALTER TABLE public.ga4_daily ADD COLUMN account_id uuid REFERENCES public.accounts(id);

-- 2) Drop old unique constraint and create new one
ALTER TABLE public.ga4_daily DROP CONSTRAINT ga4_daily_workspace_id_date_key;
ALTER TABLE public.ga4_daily ADD CONSTRAINT ga4_daily_workspace_account_date_key UNIQUE (workspace_id, account_id, date);

-- 3) Add account_id to ga4_by_source
ALTER TABLE public.ga4_by_source ADD COLUMN account_id uuid REFERENCES public.accounts(id);

-- 4) Drop old unique constraint and create new one
ALTER TABLE public.ga4_by_source DROP CONSTRAINT ga4_by_source_workspace_id_date_source_medium_key;
ALTER TABLE public.ga4_by_source ADD CONSTRAINT ga4_by_source_workspace_account_date_source_medium_key UNIQUE (workspace_id, account_id, date, source, medium);

-- 5) Index for efficient lookups
CREATE INDEX idx_ga4_daily_account ON public.ga4_daily(account_id);
CREATE INDEX idx_ga4_by_source_account ON public.ga4_by_source(account_id);
