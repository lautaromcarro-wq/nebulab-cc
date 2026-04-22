# Nebulab Command Center — Agent Context

> Multi-tenant performance marketing analytics platform.
> Integrates Meta Ads + Google Ads + GA4. Syncs daily, aggregates by segment, surfaces dashboards.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18.3, TypeScript 5.8, Vite 5.4 |
| UI Kit | Shadcn UI (Radix primitives) + Tailwind CSS 3.4 |
| Charts | Recharts 2.15 |
| Data Fetching | TanStack React Query v5 |
| Forms | React Hook Form + Zod |
| Backend | Supabase (PostgreSQL + Deno Edge Functions) |
| Auth | Supabase Auth (magic link + OAuth2) |
| Multi-tenancy | RLS via `workspace_id` on all tables |

---

## Key Environment Variables

```env
# Frontend (.env)
VITE_SUPABASE_URL=https://hagggvnmwsnshkofhmmq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[anon JWT]

# Edge Functions (Supabase secrets)
SUPABASE_SERVICE_ROLE_KEY
META_APP_ID / META_APP_SECRET / META_BUSINESS_ACCOUNT_ID
GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET / GOOGLE_ADS_DEVELOPER_TOKEN / GOOGLE_ADS_LOGIN_CUSTOMER_ID
GA4_CLIENT_ID / GA4_CLIENT_SECRET
```

---

## Directory Structure

```
src/
  pages/          # 25+ React pages (see Pages section)
  components/     # Shared components + 65+ Shadcn UI primitives
  contexts/       # AuthContext, WorkspaceContext, ClientContext
  hooks/          # React Query hooks (usePerformanceData, usePlatformMetrics, etc.)
  integrations/supabase/
    client.ts     # Supabase client init
    types.ts      # Auto-generated DB types (source of truth for schema)

supabase/
  functions/      # 28 Deno Edge Functions (see Functions section)
  migrations/     # 28 SQL migrations (chronological schema history)
  config.toml     # JWT verification disabled for webhook functions
```

---

## Pages

| Page | Route | Purpose |
|------|-------|---------|
| `Home.tsx` | `/` | Dashboard: KPIs, health score, segment scorecard, platform metrics |
| `Performance.tsx` | `/performance` | Campaign analytics: 2 tabs (Meta/Google), period comparison, ROAS/CPA/CTR |
| `Finance.tsx` | `/finance` | P&L: revenue vs spend, COGS, margin, financial settings |
| `ClientHub.tsx` | `/clients` | Client list, financial settings, token generation for public reports |
| `ClientReport.tsx` | `/report/:token` | Public dashboard (no auth), token-based, for external clients |
| `SegmentsSettings.tsx` | `/segments` | Define segment_rules, map campaigns, view conflicts |
| `Connections.tsx` | `/connections` | Connect/disconnect Meta, Google Ads, GA4 |
| `Creatives.tsx` | `/creatives` | Creative assets, filter by type, track creative performance |
| `Experiments.tsx` | `/experiments` | A/B tests, variant comparison, AI insights |
| `Tasks.tsx` | `/tasks` | Team tasks linked to clients/segments |
| `Changelog.tsx` | `/changelog` | Team activity feed |
| `BudgetTracker.tsx` | `/budget` | MTD spend vs monthly_budget per segment |
| `AdminOps.tsx` | `/admin` | Trigger job-orchestrator, view sync_runs, health_events |
| `WorkspaceSettings.tsx` | `/settings` | Name, currency, timezone |
| `WorkspaceMembers.tsx` | `/members` | Add/remove team members, manage roles |

---

## Edge Functions (28 total)

### Data Sync
| Function | Trigger | What it does |
|----------|---------|-------------|
| `sync-meta-accounts` | Phase 1 / manual | Discovers Meta ad accounts + catalog |
| `sync-meta-daily` | Phase 2 / manual | Fetches Meta spend, impressions, clicks, purchases, revenue (3-day window) |
| `sync-google-daily` | Phase 2 / manual | Fetches Google Ads metrics |
| `sync-ga4-daily` | Phase 2 / manual | Fetches GA4 events, sessions, users, engagement |
| `sync-ga4-by-source` | Phase 2 / manual | Fetches GA4 data by traffic source/channel |

### Computation
| Function | Trigger | What it does |
|----------|---------|-------------|
| `job-orchestrator` | Cron (main) | Master scheduler: 7 phases, retry logic, concurrency limits (2/provider) |
| `compute-campaign-segment-map` | Phase 5 | Maps campaigns → segments via segment_rules (contains/starts_with/regex/in_list) |
| `compute-segment-daily` | Phase 6 | Aggregates performance_daily → segment_daily by segment_id + date |
| `aggregate-revenue` | Phase 4 | Adds revenue_costs, computes contribution margin |
| `compute-workspace-health` | Phase 7 | Health score (0-100) based on integration status + data freshness |

### OAuth
| Function | What it does |
|----------|-------------|
| `oauth-start-meta/google-ads/ga4` | Returns authorization URL, initiates flow |
| `oauth-callback-meta/google-ads/ga4` | Exchanges code for token, stores in `integrations` table |

### Reporting & AI
| Function | What it does |
|----------|-------------|
| `get-client-dashboard` | Token-based public API for ClientReport page (no auth) |
| `ai-analyst` | AI-generated insights (Claude API) triggered from Home |
| `generate-experiment-insight` | AI insights for A/B test results |
| `send-weekly-report` | Email digest with KPIs + alerts (cron weekly) |

### Utilities
`backfill-historical`, `meta-diagnostics`, `debug-env-ga4`, `debug-env-google-ads`, `debug-ga4-discovery`, `debug-google-ads-discovery`, `debug-workspace-health`

---

## Database Schema (Key Tables)

```sql
-- Multi-tenancy
workspaces           { id, name, currency, timezone, status }
workspace_members    { workspace_id, user_id, role (owner/analyst/viewer) }

-- Clients
clients              { id, workspace_id, name, status, tags }

-- Integrations & Accounts
integrations         { workspace_id, provider, status, token, refresh_token, token_expires_at }
accounts             { workspace_id, integration_id, provider, external_account_id, name, status }

-- Campaign Structure
campaigns            { workspace_id, account_id, external_id, name, provider, status }
adsets               { workspace_id, campaign_id, external_id, name, provider, status }
ads                  { workspace_id, campaign_id, adset_id, creative_id, external_id, name }

-- Performance (raw, daily)
performance_daily    {
  workspace_id, client_id, account_id, campaign_id, date, provider,
  entity_type (account/campaign/adset/ad), entity_id,
  spend, impressions, clicks, ctr, purchases, revenue, cpc, cpa, roas,
  reach, landing_page_views, video_views_3s, outbound_clicks,
  conversions_breakdown (JSONB)
}

-- GA4 (separate from performance_daily)
ga4_daily            { workspace_id, account_id, property_id, date, sessions, users, screen_page_views, engagement_duration_secs, bounce_rate, events }
ga4_by_source        { workspace_id, account_id, property_id, date, source, channel_group, sessions, users, transactions, revenue }

-- Segments
segments             { id, workspace_id, client_id, name, monthly_budget, currency, color }
segment_rules        { id, workspace_id, segment_id, platform, rule_type, rule_value, priority, is_inclusive }
campaign_segment_map { segment_id, campaign_id, account_id, assigned_at }
segment_daily        { workspace_id, segment_id, date, spend, spend_meta, spend_google, clicks, impressions, purchases, revenue_platform, revenue_ga4 }

-- Finance
financial_settings   { workspace_id, client_id, avg_cogs_percent, shipping_percent, payment_fee_percent, refund_percent, iva_percent }
revenue_costs        { workspace_id, client_id, date, cost_type, amount }

-- Creative Assets
creative_assets      { workspace_id, provider, external_asset_id, asset_url, asset_hash, asset_type, thumbnail_url, creative_id }
creatives            { workspace_id, canonical_hash, creative_type, canonical_url, performance_summary }

-- Experiments
experiments          { workspace_id, client_id, name, control_id, variant_ids (JSONB), start_date, end_date, status }

-- System
health_events        { workspace_id, provider, check_type, message, severity (critical/warn/info), resolved }
sync_runs            { workspace_id, provider, job_name, status, started_at, ended_at, items_upserted, error_message, retry_count }
sync_locks           { workspace_id, provider, job_name, locked_until }

-- Client Access (public dashboards)
client_access_tokens { workspace_id, client_id, token (UUID), label, active, last_accessed_at }

-- Tasks & Changelog
tasks                { workspace_id, client_id, title, assigned_to, status, priority, due_date }
changelog_entries    { workspace_id, author_id, entry_type, entry_text, metadata (JSONB) }
```

---

## Data Flow

```
External Platforms (Meta / Google Ads / GA4)
  → sync-* functions (OAuth2 tokens from integrations table)
  → performance_daily, ga4_daily, ga4_by_source (raw)
  → job-orchestrator phases:
      Phase 1: Account catalog sync
      Phase 2: Daily metrics sync (parallel, max 2/provider)
      Phase 3: Creative resolution (hash dedup)
      Phase 4: aggregate-revenue (add costs, margins)
      Phase 5: compute-campaign-segment-map (apply rules)
      Phase 6: compute-segment-daily (aggregate by segment + date)
      Phase 7: compute-workspace-health (score + health_events)
  → Frontend via React Query hooks
  → Public: /report/:token → get-client-dashboard (no auth)
```

---

## Shared Contexts

| Context | State |
|---------|-------|
| `AuthContext` | Supabase session + user |
| `WorkspaceContext` | `workspaceId`, `segmentId`, `dateRange`, `currency` |
| `ClientContext` | Active `clientId` |

Changing workspace/client/segment triggers React Query key invalidation and data re-fetch.

---

## Job Orchestration Details

- **Entry**: `job-orchestrator` invoked by cron
- **Concurrency**: max 2 jobs per provider to avoid API rate limits
- **Locking**: `sync_locks` table prevents duplicate concurrent runs
- **Retry**: Exponential backoff — 1s, 2s, 4s (max 3 attempts)
- **Observability**: All runs logged in `sync_runs`; failures generate `health_events`
- **Integration degradation**: 3+ consecutive failures → integration marked `degraded`

---

## Segment Rules Engine

Rules match campaign names to segments:

| Rule Type | Example |
|-----------|---------|
| `contains` | name includes "prospecting" |
| `starts_with` | name starts with "REM_" |
| `regex` | `^TOP_.*_2026$` |
| `in_list` | campaign_id in `["123","456"]` |

Priority order resolves conflicts. Conflicting assignments logged to `health_events`.

---

## Financial Model

```
Gross Revenue (from performance_daily.revenue)
- Ad Spend (spend)
- COGS (avg_cogs_percent × revenue)
- Shipping (shipping_percent × revenue)
- Payment Fees (payment_fee_percent × revenue)
- Refunds (refund_percent × revenue)
= Contribution Margin
Margin % = Contribution Margin / Revenue
```

---

## RLS Pattern

Every table has `workspace_id`. Access controlled by:

```sql
CREATE FUNCTION is_workspace_member(user_id uuid, workspace_id uuid)
-- Returns true if user is in workspace_members for that workspace
```

Roles: `owner` > `analyst` > `viewer`. Some tables (integrations) restricted to `owner`.

---

## Key Files for Common Tasks

| Task | File |
|------|------|
| Add a new metric to performance sync | `supabase/functions/sync-meta-daily/index.ts` |
| Add a DB column | New file in `supabase/migrations/` |
| Add a new dashboard widget | `src/pages/Home.tsx` + relevant hook in `src/hooks/` |
| Modify segment rule logic | `supabase/functions/compute-campaign-segment-map/index.ts` |
| Modify health scoring | `supabase/functions/compute-workspace-health/index.ts` |
| Change public dashboard data | `supabase/functions/get-client-dashboard/index.ts` |
| Add a new page | `src/pages/NewPage.tsx` + route in `src/App.tsx` |
| TypeScript DB types | `src/integrations/supabase/types.ts` (auto-generated, do not edit manually) |

---

## Architecture Decisions

1. **Segment-first design**: Campaigns are only meaningful as part of segments. The segment is the atomic unit for budget, performance, and reporting.
2. **Phase-based orchestration over event-driven**: Phases ensure data dependencies are respected (can't compute segment_daily before campaign_segment_map exists).
3. **Public dashboards via token**: Avoids requiring clients to create Supabase accounts. Simple UUID token in URL is sufficient.
4. **GA4 stored separately**: GA4 uses a different entity model (sessions/users vs campaigns/ads), so it's in dedicated tables rather than shoehorned into performance_daily.
5. **Financial settings per client**: Each client can have different COGS %, margins, etc. — reflects reality of multi-client agencies.
6. **Hash-based creative deduplication**: Same creative asset used across multiple ad sets gets one canonical record, enabling cross-campaign creative performance analysis.
