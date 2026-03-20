-- Dashboard metrics expansion
-- Adds site engagement metrics to GA4 tables and advanced ad metrics to performance_daily

-- ── ga4_daily: engagement metrics ────────────────────────────────────────────
ALTER TABLE public.ga4_daily
  ADD COLUMN IF NOT EXISTS sessions                 bigint  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS users                    bigint  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS screen_page_views        bigint  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_duration_secs bigint  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounce_rate              numeric NOT NULL DEFAULT 0;

-- ── ga4_by_source: channel group + sessions ───────────────────────────────────
ALTER TABLE public.ga4_by_source
  ADD COLUMN IF NOT EXISTS sessions      bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS channel_group text   NOT NULL DEFAULT '(other)';

-- ── performance_daily: Meta advanced + Google conversions breakdown ───────────
ALTER TABLE public.performance_daily
  ADD COLUMN IF NOT EXISTS reach                  bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS landing_page_views     bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_views_3s         bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outbound_clicks        bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversions_breakdown  jsonb  DEFAULT '{}';
