# Ecommerce Integration — Design Spec
**Date:** 2026-03-25
**Status:** Approved (v2 — post-review fixes)
**Scope:** Tiendanube (V1) + WooCommerce (V2, same model)

---

## Goal

Integrate ecommerce store data (orders, products, customers, abandoned carts) into Nebulab Command Center. Revenue from orders supplements or replaces GA4 revenue in Home, Finance, and the AI Analyst. A new `/ecommerce` page provides full store visibility.

---

## Architecture

### Approach: Dedicated schema + bridge to existing revenue pipeline

All ecommerce data lives in 4 new tables isolated from ads data. A daily aggregation job merges order revenue into the existing `source_breakdown` JSONB column of `workspace_revenue_daily` — zero schema changes. The scorecard reads `source_breakdown.ecommerce` when available, falls back to GA4 `total_revenue`.

### Data Flow

```
Tiendanube API / WooCommerce REST API
        ↓ (API key per client, stored as plaintext with RLS — same as rest of system)
sync-ecommerce-daily (Supabase Edge Function, job-orchestrator phase 8)
        ↓ upsert
ecommerce_orders · ecommerce_products · ecommerce_customers · ecommerce_carts
        ↓
aggregate-ecommerce-revenue (job-orchestrator phase 9, runs after phase 8)
        ↓ UPDATE source_breakdown = source_breakdown || '{"ecommerce": total}'
workspace_revenue_daily  ← scorecard reads source_breakdown.ecommerce ?? total_revenue
```

---

## Database Changes

### `workspace_revenue_daily` — zero schema changes needed

The table already has `source_breakdown: JsonB` (e.g. `{"meta": 1000, "google_ads": 500}`). The existing `aggregate-revenue` function writes this field and upserts with `onConflict: "workspace_id,date"`.

`aggregate-ecommerce-revenue` does a simple **UPDATE** (not upsert) on the existing row:
```sql
UPDATE workspace_revenue_daily
SET source_breakdown = source_breakdown || '{"ecommerce": <total>}'::jsonb
WHERE workspace_id = $wsId AND date = $date;
```

Or via Supabase client using `rpc` or a targeted update. **No schema changes. No PK changes. No breaking changes to `aggregate-revenue/index.ts`.**

The scorecard (`useScorecard`) already reads `source_breakdown` — it now additionally checks for `source_breakdown.ecommerce`. If present, it uses that value as `effective_revenue` instead of `total_revenue` (GA4). If absent, falls back to `total_revenue` as before.

### New table: `ecommerce_connections`
```sql
CREATE TABLE ecommerce_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  client_id uuid NOT NULL REFERENCES clients(id),
  provider TEXT NOT NULL CHECK (provider IN ('tiendanube', 'woocommerce')),
  store_url TEXT NOT NULL,
  api_key TEXT NOT NULL,          -- plaintext with RLS, same as integrations.access_token
  api_secret TEXT,                -- WooCommerce only
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected','error','disconnected')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, client_id, provider)  -- prevents duplicate connections
);
```

### New table: `ecommerce_orders`
```sql
CREATE TABLE ecommerce_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  client_id uuid NOT NULL REFERENCES clients(id),
  provider TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL,           -- paid | pending | cancelled | refunded
  total NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  customer_email TEXT,
  items_count INT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  UNIQUE (workspace_id, external_id, provider)
);
```

### New table: `ecommerce_products`
```sql
CREATE TABLE ecommerce_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  client_id uuid NOT NULL REFERENCES clients(id),
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC,
  stock INT,                      -- NULL = unlimited/untracked
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, external_id, provider)
);
-- NOTE: sold_count_mtd and revenue_mtd are NOT stored here.
-- They are computed at query time from ecommerce_orders JOIN ecommerce_order_items.
-- This avoids stale aggregates when syncs are partial or retrospective.
```

### New table: `ecommerce_order_items`
```sql
CREATE TABLE ecommerce_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES ecommerce_orders(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  product_external_id TEXT,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL,
  unit_price NUMERIC NOT NULL
);
```

### New table: `ecommerce_customers`
```sql
CREATE TABLE ecommerce_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  client_id uuid NOT NULL REFERENCES clients(id),
  provider TEXT NOT NULL,
  email TEXT,
  orders_count INT NOT NULL DEFAULT 0,
  total_spent NUMERIC NOT NULL DEFAULT 0,
  first_order_at DATE,
  last_order_at DATE,
  segment TEXT NOT NULL DEFAULT 'new' CHECK (segment IN ('new','returning','vip')),
  -- segment is computed by aggregate-ecommerce-revenue after each sync:
  -- new = orders_count = 1
  -- returning = orders_count 2-4
  -- vip = orders_count >= 5 OR total_spent >= 3x avg_ticket for client
  UNIQUE (workspace_id, external_id, provider)
);
```

### New table: `ecommerce_carts`
```sql
CREATE TABLE ecommerce_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  client_id uuid NOT NULL REFERENCES clients(id),
  provider TEXT NOT NULL,
  customer_email TEXT,
  value NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'abandoned' CHECK (status IN ('abandoned','recovered','lost')),
  abandoned_at TIMESTAMPTZ NOT NULL,
  recovered_at TIMESTAMPTZ,
  items JSONB,                    -- [{product_id, name, qty, price}]
  UNIQUE (workspace_id, external_id, provider)
);
```

---

## Edge Functions

### `sync-ecommerce-daily` (new)
- **Trigger:** job-orchestrator, phase 3 (after GA4 sync), iterates over `ecommerce_connections` with `status != 'disconnected'`
- **Input:** `{ connectionId, dateFrom, dateTo }`
- **First sync / backfill:** On first run (`last_sync_at IS NULL`), defaults to `dateFrom = 30 days ago`. Paginates Tiendanube API (100 orders/page) and WooCommerce (100/page) until all pages fetched or 90-day limit.
- **Provider fetchers:**
  - `fetchTiendanube(connection, dateRange)` — GET `/v1/orders?created_at_min&created_at_max&per_page=100`
  - `fetchWooCommerce(connection, dateRange)` — GET `/wp-json/wc/v3/orders?after&before&per_page=100`
- **Upserts:** orders + order_items + customers + carts (products synced separately, not date-filtered)
- **On error:** sets `ecommerce_connections.status = 'error'`, writes `last_error`, continues to next connection
- **Updates:** `last_sync_at`, `status = 'connected'` on success

### `aggregate-ecommerce-revenue` (new)
- **Trigger:** job-orchestrator, phase 4 (after sync-ecommerce-daily)
- **Logic:**
  1. Aggregate `ecommerce_orders` WHERE `status = 'paid'` GROUP BY `(workspace_id, client_id, date)`
  2. Upsert into `workspace_revenue_daily` with `revenue_source = 'ecommerce'`
  3. Recompute `ecommerce_customers.segment` for all affected clients:
     - `new`: orders_count = 1
     - `returning`: orders_count 2–4
     - `vip`: orders_count ≥ 5 OR total_spent ≥ 3 × (client avg_ticket)

### `job-orchestrator` updates
Current phases: 1 (accounts), 2 (daily metrics), 3 (creatives), 4 (aggregate_revenue/GA4), 5 (segment_map), 6 (segment_daily), 7 (health). Ecommerce jobs use **phases 8 and 9** to run after all existing jobs complete with zero conflicts.

Add to `JOB_DEFS`:
```typescript
{ name: 'sync_ecommerce_daily',        provider: null, phase: 8 },
{ name: 'aggregate_ecommerce_revenue', provider: null, phase: 9 },
```

Phase 8 iteration: query `ecommerce_connections WHERE workspace_id = $wsId AND status != 'disconnected'`, invoke `sync-ecommerce-daily` for each `connectionId`. If no connections exist for the workspace, skip.

Phase 9: single invocation of `aggregate-ecommerce-revenue` with `workspaceId`. Reads all paid orders from current day and writes `ecommerce_revenue` to `workspace_revenue_daily`.

---

## Revenue Coexistence (GA4 + Ecommerce)

`workspace_revenue_daily` stores one row per `(workspace_id, date)` (existing PK — unchanged).

The `source_breakdown` JSONB column already holds per-provider breakdowns (e.g. `{"meta": 1000, "google_ads": 500}`). `aggregate-ecommerce-revenue` merges `{"ecommerce": Z}` into this object via UPDATE — no new columns, no PK changes.

In `useScorecard`, each row already returns `source_breakdown`. The hook now reads:
```typescript
const effectiveRevenue = (row.source_breakdown as any)?.ecommerce ?? row.total_revenue;
```
Falls back to GA4 `total_revenue` automatically when ecommerce is not synced.

**UI indicator:** When `source_breakdown.ecommerce` is present for any row in the selected date range, the Home Hero KPI label changes from "Revenue GA4" to "Revenue Real 🛍". Tooltip: "Revenue real de tienda (Tiendanube/WooCommerce)".

---

## Frontend

### New page: `/ecommerce`
Added to nav under "Performance" section.

**KPI Strip (always visible, with delta vs prev period + semáforo color):**
- Revenue Real MTD
- Órdenes
- Ticket Promedio
- Clientes Nuevos MTD
- Carritos Abandonados (value + count)

**4 Tabs:** Órdenes · Productos · Clientes · Carritos Abandonados
(See mockups in `.superpowers/brainstorm/`)

### Client Hub — Connection settings
New "Tienda Online" section in client settings:
- Select provider (Tiendanube / WooCommerce)
- Input: Store URL + API key (+ secret for WooCommerce)
- "Probar conexión" button → calls sync function with `testOnly: true`
- Status badge + "Último sync" timestamp
- Error message display when `status = 'error'`

### Global Health Drawer
Ecommerce sync errors surface in the existing `GlobalHealthDrawer` alongside workspace health penalties.

---

## Security
API keys stored as plaintext `TEXT` columns with Row Level Security, identical to how `integrations.access_token` is stored in the existing system. No additional encryption in V1. Supabase RLS ensures workspace isolation.

---

## V1 Scope (Tiendanube)
- Migration: new tables only (`ecommerce_connections`, `ecommerce_orders`, `ecommerce_order_items`, `ecommerce_products`, `ecommerce_customers`, `ecommerce_carts`) — no changes to `workspace_revenue_daily`
- `sync-ecommerce-daily` with Tiendanube fetcher + 30-day backfill on first run
- `aggregate-ecommerce-revenue` with customer segmentation — UPDATEs `source_breakdown` JSONB
- `job-orchestrator` phase 8+9 additions
- `useScorecard` must add `source_breakdown` to its select query
- `/ecommerce` page: KPI strip + 4 tabs
- Client Hub: connection UI for Tiendanube
- Revenue bridge: scorecard uses ecommerce revenue when connected

## V2 Scope (WooCommerce)
- Add `fetchWooCommerce` to existing sync function
- Add WooCommerce option to Client Hub connection UI
- No schema changes needed
