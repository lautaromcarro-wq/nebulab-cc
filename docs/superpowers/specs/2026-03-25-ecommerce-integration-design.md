# Ecommerce Integration — Design Spec
**Date:** 2026-03-25
**Status:** Approved
**Scope:** Tiendanube (V1) + WooCommerce (V2, same model)

---

## Goal

Integrate ecommerce store data (orders, products, customers, abandoned carts) into Nebulab Command Center. Revenue from orders replaces platform revenue in Home, Finance, and the AI Analyst. A new `/ecommerce` page provides full store visibility.

---

## Architecture

### Approach: Dedicated schema + bridge to existing revenue pipeline

All ecommerce data lives in 4 new tables isolated from ads data. A daily aggregation job writes order revenue into `workspace_revenue_daily` (existing table), which the scorecard and Finance already consume — no changes needed to those systems.

### Data Flow

```
Tiendanube API / WooCommerce REST API
        ↓ (API key or token per client, stored in client record)
sync-ecommerce-daily (Supabase Edge Function, runs daily)
        ↓ upsert
ecommerce_orders · ecommerce_products · ecommerce_customers · ecommerce_carts
        ↓
aggregate-ecommerce-revenue (job, runs after sync)
        ↓ upsert
workspace_revenue_daily  ← already consumed by scorecard, Home, Finance, AI Analyst
```

### Authentication
- Per-client credentials stored in a new `ecommerce_connections` table
- Fields: `client_id`, `workspace_id`, `provider` (tiendanube | woocommerce), `api_key`, `store_url`, `status`
- Admin enters credentials manually from Client Hub settings

---

## New Database Tables

### `ecommerce_connections`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK |
| client_id | uuid | FK |
| provider | enum | tiendanube \| woocommerce |
| store_url | text | Base URL of the store |
| api_key | text | Encrypted |
| api_secret | text | Encrypted (WooCommerce only) |
| status | enum | connected \| error \| disconnected |
| last_sync_at | timestamptz | |

### `ecommerce_orders`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| external_id | text | Order ID from platform |
| workspace_id | uuid | FK |
| client_id | uuid | FK |
| provider | enum | tiendanube \| woocommerce |
| date | date | Order date |
| status | text | paid \| pending \| cancelled \| refunded |
| total | numeric | Order total in original currency |
| currency | text | ARS \| USD etc. |
| customer_email | text | |
| customer_id | uuid | FK to ecommerce_customers |
| items_count | int | Number of line items |
| utm_source | text | From order metadata if available |
| utm_medium | text | |
| utm_campaign | text | |

### `ecommerce_products`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| external_id | text | Product ID from platform |
| workspace_id | uuid | FK |
| client_id | uuid | FK |
| provider | enum | |
| name | text | |
| price | numeric | |
| stock | int | null = unlimited |
| category | text | |
| sold_count_mtd | int | Updated by sync |
| revenue_mtd | numeric | Updated by sync |
| is_active | boolean | |
| updated_at | timestamptz | |

### `ecommerce_customers`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| external_id | text | Customer ID from platform |
| workspace_id | uuid | FK |
| client_id | uuid | FK |
| provider | enum | |
| email | text | |
| orders_count | int | Total historical |
| total_spent | numeric | LTV |
| first_order_at | date | |
| last_order_at | date | |
| segment | enum | new \| returning \| vip |

### `ecommerce_carts`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| external_id | text | |
| workspace_id | uuid | FK |
| client_id | uuid | FK |
| provider | enum | |
| customer_email | text | |
| value | numeric | Cart total |
| status | enum | abandoned \| recovered \| lost |
| abandoned_at | timestamptz | |
| recovered_at | timestamptz | null if not recovered |
| items | jsonb | Array of {product_id, name, qty, price} |

---

## Edge Functions

### `sync-ecommerce-daily`
- Triggered by `job-orchestrator` daily (same pattern as sync-meta-daily)
- Receives: `connectionId`, `dateFrom`, `dateTo`
- Provider-specific fetchers in the same function:
  - `fetchTiendanube(connection, dateRange)` — uses Tiendanube REST API
  - `fetchWooCommerce(connection, dateRange)` — uses WooCommerce REST API v3
- Upserts to all 4 ecommerce tables
- Updates `last_sync_at` and `status` on `ecommerce_connections`

### `aggregate-ecommerce-revenue`
- Runs after `sync-ecommerce-daily` completes
- Aggregates `ecommerce_orders` (status = paid) by `client_id` + `date`
- Upserts into `workspace_revenue_daily` with `revenue_source = 'ecommerce'`
- Replaces GA4 revenue as the primary revenue source when ecommerce is connected

---

## Frontend

### New page: `/ecommerce`
Added to nav under "Performance" section.

**KPI Strip (always visible):**
- Revenue Real (MTD) + delta vs prev period
- Órdenes + delta
- Ticket Promedio + delta
- Clientes Nuevos MTD + delta
- Carritos Abandonados (value + count)

**4 Tabs:**

#### Órdenes
- Table: #Order, Cliente, Fecha, Total, Estado, Fuente (UTM-based attribution)
- Filtros: estado, fecha
- CSV export

#### Productos
- Mini KPIs: activos, sin stock, más vendido, revenue top 10
- Table: Producto, Categoría, Precio, Vendidos MTD, Revenue MTD, Stock (with 0-stock warning)
- Sort por cualquier columna

#### Clientes
- Mini KPIs: total, % recurrentes, LTV promedio, nuevos MTD
- Table: Cliente, Órdenes, LTV Total, Primera orden, Última orden, Tipo (Nuevo/Recurrente/VIP)
- VIP = 5+ órdenes o LTV > 3× ticket promedio

#### Carritos Abandonados
- Mini KPIs: revenue perdido, cantidad, tasa abandono, % recuperados
- Table: Cliente, Productos, Valor, Abandonado (relative time), Estado

### Client Hub — Connection settings
New "Tienda Online" section in client settings:
- Select provider (Tiendanube / WooCommerce)
- Input store URL + API key (+ secret for WooCommerce)
- Test connection button
- Last sync status indicator

### Revenue impact on existing pages
- **Home Hero KPIs**: `revenueGa4` label changes to `Revenue Real` when ecommerce is connected
- **Finance**: ecommerce revenue appears as a revenue source line
- **AI Analyst**: context includes ecommerce summary (top products, LTV, cart abandonment rate)

---

## Customer Segmentation Logic

| Segment | Criteria |
|---------|----------|
| Nuevo | orders_count = 1 |
| Recurrente | orders_count 2–4 |
| VIP | orders_count ≥ 5 OR total_spent ≥ 3× avg ticket |

---

## Error Handling

- Sync failures update `ecommerce_connections.status = 'error'` with error message
- Global Health Drawer shows ecommerce sync errors alongside existing health penalties
- Partial sync (e.g., products synced but orders failed) logs per-entity status

---

## V1 Scope (Tiendanube only)
- `ecommerce_connections` table + Client Hub UI
- `sync-ecommerce-daily` with Tiendanube fetcher
- `aggregate-ecommerce-revenue` job
- `/ecommerce` page with all 4 tabs
- Revenue bridge to `workspace_revenue_daily`

## V2 Scope (WooCommerce)
- Add `fetchWooCommerce` to existing sync function
- Add WooCommerce option to Client Hub connection UI
- No schema changes needed
