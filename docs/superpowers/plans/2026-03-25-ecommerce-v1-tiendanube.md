# Ecommerce V1 — Tiendanube Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Tiendanube store data (orders, products, customers, abandoned carts) into Nebulab Command Center — daily sync, revenue bridge to existing scorecard, and a full `/ecommerce` page with 4 tabs.

**Architecture:** 6 new DB tables (ecommerce_connections, ecommerce_orders, ecommerce_order_items, ecommerce_products, ecommerce_customers, ecommerce_carts) live in their own schema. `aggregate-ecommerce-revenue` merges order revenue into `workspace_revenue_daily.source_breakdown` JSONB via UPDATE — zero schema changes to existing tables. `useScorecard` falls back to GA4 when ecommerce is not connected. The job-orchestrator gains phases 8 and 9.

**Spec:** `docs/superpowers/specs/2026-03-25-ecommerce-integration-design.md`

**Tech Stack:** Supabase Edge Functions (Deno/TypeScript), PostgreSQL, React, shadcn/ui, @tanstack/react-query, Tiendanube REST API v1

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/20260325000001_ecommerce_tables.sql` | 6 new tables + RLS policies |
| Create | `supabase/functions/sync-ecommerce-daily/index.ts` | Tiendanube sync + upsert orders/products/customers/carts |
| Create | `supabase/functions/aggregate-ecommerce-revenue/index.ts` | Aggregate paid orders → workspace_revenue_daily.source_breakdown |
| Modify | `supabase/functions/job-orchestrator/index.ts` | Add phases 8 + 9 to JOB_DEFS and executeJob switch |
| Modify | `src/hooks/useScorecard.ts` | Add source_breakdown to revQuery select, compute effectiveRevenue |
| Create | `src/pages/Ecommerce.tsx` | /ecommerce page: KPI strip + 4 tabs |
| Modify | `src/pages/ClientHub.tsx` | Add "Tienda Online" tab with connection settings UI |
| Modify | `src/components/AppLayout.tsx` | Add /ecommerce nav link under Performance section |
| Modify | `src/App.tsx` | Register /ecommerce route |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260325000001_ecommerce_tables.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260325000001_ecommerce_tables.sql

-- ── ecommerce_connections ────────────────────────────────────────────────────
CREATE TABLE ecommerce_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('tiendanube', 'woocommerce')),
  store_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  api_secret TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected','error','disconnected')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, client_id, provider)
);

ALTER TABLE ecommerce_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members" ON ecommerce_connections
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ── ecommerce_orders ─────────────────────────────────────────────────────────
CREATE TABLE ecommerce_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL,
  total NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  customer_email TEXT,
  items_count INT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  UNIQUE (workspace_id, external_id, provider)
);

ALTER TABLE ecommerce_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members" ON ecommerce_orders
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ── ecommerce_order_items ────────────────────────────────────────────────────
CREATE TABLE ecommerce_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES ecommerce_orders(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  product_external_id TEXT,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL,
  unit_price NUMERIC NOT NULL
);

ALTER TABLE ecommerce_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members" ON ecommerce_order_items
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ── ecommerce_products ───────────────────────────────────────────────────────
CREATE TABLE ecommerce_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC,
  stock INT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, external_id, provider)
);

ALTER TABLE ecommerce_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members" ON ecommerce_products
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ── ecommerce_customers ──────────────────────────────────────────────────────
CREATE TABLE ecommerce_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  email TEXT,
  orders_count INT NOT NULL DEFAULT 0,
  total_spent NUMERIC NOT NULL DEFAULT 0,
  first_order_at DATE,
  last_order_at DATE,
  segment TEXT NOT NULL DEFAULT 'new' CHECK (segment IN ('new','returning','vip')),
  UNIQUE (workspace_id, external_id, provider)
);

ALTER TABLE ecommerce_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members" ON ecommerce_customers
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ── ecommerce_carts ──────────────────────────────────────────────────────────
CREATE TABLE ecommerce_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  customer_email TEXT,
  value NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'abandoned' CHECK (status IN ('abandoned','recovered','lost')),
  abandoned_at TIMESTAMPTZ NOT NULL,
  recovered_at TIMESTAMPTZ,
  items JSONB,
  UNIQUE (workspace_id, external_id, provider)
);

ALTER TABLE ecommerce_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members" ON ecommerce_carts
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_ecommerce_orders_workspace_date ON ecommerce_orders (workspace_id, date);
CREATE INDEX idx_ecommerce_orders_client ON ecommerce_orders (client_id, date);
CREATE INDEX idx_ecommerce_customers_client ON ecommerce_customers (client_id);
CREATE INDEX idx_ecommerce_carts_workspace ON ecommerce_carts (workspace_id, abandoned_at);
```

- [ ] **Step 2: Apply migration**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && supabase db push 2>&1 | tail -20
```
Expected: Migration applied successfully. If supabase CLI not linked, use the Supabase dashboard SQL editor to run the SQL manually.

- [ ] **Step 3: Commit**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && git add supabase/migrations/ && git commit -m "feat(db): add ecommerce tables migration (connections, orders, products, customers, carts)"
```

---

### Task 2: sync-ecommerce-daily edge function

**Files:**
- Create: `supabase/functions/sync-ecommerce-daily/index.ts`

- [ ] **Step 1: Create the function**

```typescript
// supabase/functions/sync-ecommerce-daily/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BACKFILL_DAYS = 30;
const PAGE_SIZE = 100;

interface SyncInput {
  connectionId: string;
  dateFrom?: string;
  dateTo?: string;
  testOnly?: boolean;
}

interface TiendanubeOrder {
  id: number;
  status: string;
  payment_status: string;
  total: string;
  currency: string;
  contact_email?: string;
  created_at: string;
  products: Array<{ product_id: number; name: string; quantity: number; price: string }>;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

interface TiendanubeProduct {
  id: number;
  name: { es?: string; [k: string]: string | undefined };
  variants: Array<{ price: string; stock: number | null }>;
  categories: Array<{ name: { es?: string; [k: string]: string | undefined } }>;
  published: boolean;
}

interface TiendanubeCart {
  id: number;
  contact_email?: string;
  total: string;
  status: string;
  abandoned_checkout_url?: string;
  created_at: string;
  completed_at?: string | null;
  products?: Array<{ product_id: number; name: string; quantity: number; price: string }>;
}

async function fetchTiendanubeOrders(
  storeId: string,
  apiKey: string,
  dateFrom: string,
  dateTo: string,
): Promise<TiendanubeOrder[]> {
  const allOrders: TiendanubeOrder[] = [];
  let page = 1;
  while (true) {
    const url = `https://api.tiendanube.com/v1/${storeId}/orders?created_at_min=${dateFrom}T00:00:00-0300&created_at_max=${dateTo}T23:59:59-0300&per_page=${PAGE_SIZE}&page=${page}`;
    const resp = await fetch(url, {
      headers: {
        Authentication: `bearer ${apiKey}`,
        "User-Agent": "Nebulab/1.0 (lautaro@nebulab.app)",
        "Content-Type": "application/json",
      },
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Tiendanube orders HTTP ${resp.status}: ${text}`);
    }
    const data: TiendanubeOrder[] = await resp.json();
    if (data.length === 0) break;
    allOrders.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  return allOrders;
}

async function fetchTiendanubeProducts(
  storeId: string,
  apiKey: string,
): Promise<TiendanubeProduct[]> {
  const allProducts: TiendanubeProduct[] = [];
  let page = 1;
  while (true) {
    const url = `https://api.tiendanube.com/v1/${storeId}/products?per_page=${PAGE_SIZE}&page=${page}`;
    const resp = await fetch(url, {
      headers: {
        Authentication: `bearer ${apiKey}`,
        "User-Agent": "Nebulab/1.0 (lautaro@nebulab.app)",
        "Content-Type": "application/json",
      },
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Tiendanube products HTTP ${resp.status}: ${text}`);
    }
    const data: TiendanubeProduct[] = await resp.json();
    if (data.length === 0) break;
    allProducts.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  return allProducts;
}

async function fetchTiendanubeCarts(
  storeId: string,
  apiKey: string,
  dateFrom: string,
  dateTo: string,
): Promise<TiendanubeCart[]> {
  // Tiendanube abandoned checkouts endpoint
  const allCarts: TiendanubeCart[] = [];
  let page = 1;
  while (true) {
    const url = `https://api.tiendanube.com/v1/${storeId}/checkouts?created_at_min=${dateFrom}T00:00:00-0300&created_at_max=${dateTo}T23:59:59-0300&per_page=${PAGE_SIZE}&page=${page}`;
    const resp = await fetch(url, {
      headers: {
        Authentication: `bearer ${apiKey}`,
        "User-Agent": "Nebulab/1.0 (lautaro@nebulab.app)",
        "Content-Type": "application/json",
      },
    });
    if (!resp.ok) break; // Checkouts endpoint may not be available on all plans
    const data: TiendanubeCart[] = await resp.json();
    if (data.length === 0) break;
    allCarts.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  return allCarts;
}

// Extract storeId from store_url (e.g. "123456" or "https://api.tiendanube.com/v1/123456")
function extractStoreId(storeUrl: string): string {
  const match = storeUrl.match(/(\d{5,})/);
  if (!match) throw new Error(`Cannot extract store ID from: ${storeUrl}`);
  return match[1];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  try {
    const body: SyncInput = await req.json();
    const { connectionId, testOnly = false } = body;

    if (!connectionId) {
      return new Response(JSON.stringify({ success: false, error: "connectionId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch connection
    const { data: conn, error: connErr } = await db
      .from("ecommerce_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connErr || !conn) {
      return new Response(JSON.stringify({ success: false, error: "Connection not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (conn.provider !== "tiendanube") {
      return new Response(JSON.stringify({ success: false, error: `Provider ${conn.provider} not supported yet` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const storeId = extractStoreId(conn.store_url);
    const today = new Date();
    const dateTo = body.dateTo ?? today.toISOString().split("T")[0];
    const dateFrom = body.dateFrom ?? (
      conn.last_sync_at
        ? new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        : new Date(Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    );

    // Fetch data from Tiendanube
    const [orders, products, carts] = await Promise.all([
      fetchTiendanubeOrders(storeId, conn.api_key, dateFrom, dateTo),
      fetchTiendanubeProducts(storeId, conn.api_key),
      fetchTiendanubeCarts(storeId, conn.api_key, dateFrom, dateTo),
    ]);

    if (testOnly) {
      // Just test connectivity — update status but don't upsert data
      await db.from("ecommerce_connections").update({
        status: "connected",
        last_error: null,
        last_sync_at: new Date().toISOString(),
      }).eq("id", connectionId);
      return new Response(JSON.stringify({
        success: true,
        testOnly: true,
        ordersFound: orders.length,
        productsFound: products.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Upsert orders + order_items ──────────────────────────────────────────
    let ordersUpserted = 0;
    for (const order of orders) {
      const orderDate = order.created_at.split("T")[0];
      const statusNorm = order.payment_status === "paid" ? "paid"
        : order.status === "cancelled" ? "cancelled"
        : order.status === "refunded" ? "refunded"
        : "pending";

      const { data: upsertedOrder, error: orderErr } = await db
        .from("ecommerce_orders")
        .upsert({
          external_id: String(order.id),
          workspace_id: conn.workspace_id,
          client_id: conn.client_id,
          provider: "tiendanube",
          date: orderDate,
          status: statusNorm,
          total: parseFloat(order.total),
          currency: order.currency || "ARS",
          customer_email: order.contact_email ?? null,
          items_count: order.products?.length ?? null,
          utm_source: order.utm_source ?? null,
          utm_medium: order.utm_medium ?? null,
          utm_campaign: order.utm_campaign ?? null,
        }, { onConflict: "workspace_id,external_id,provider" })
        .select("id")
        .single();

      if (orderErr) continue;
      ordersUpserted++;

      // Upsert order items
      if (upsertedOrder && order.products?.length) {
        const items = order.products.map((p) => ({
          order_id: upsertedOrder.id,
          workspace_id: conn.workspace_id,
          product_external_id: String(p.product_id),
          product_name: p.name,
          quantity: p.quantity,
          unit_price: parseFloat(p.price),
        }));
        await db.from("ecommerce_order_items").upsert(items, { onConflict: "order_id,product_external_id" }).throwOnError();
      }
    }

    // ── Upsert products ──────────────────────────────────────────────────────
    let productsUpserted = 0;
    for (const product of products) {
      const name = product.name?.es ?? product.name?.[Object.keys(product.name)[0]] ?? "Sin nombre";
      const variant = product.variants?.[0];
      const price = variant?.price ? parseFloat(variant.price) : null;
      const stock = variant?.stock ?? null;
      const category = product.categories?.[0]?.name?.es ?? null;

      const { error: prodErr } = await db.from("ecommerce_products").upsert({
        external_id: String(product.id),
        workspace_id: conn.workspace_id,
        client_id: conn.client_id,
        provider: "tiendanube",
        name,
        price,
        stock,
        category,
        is_active: product.published,
        updated_at: new Date().toISOString(),
      }, { onConflict: "workspace_id,external_id,provider" });

      if (!prodErr) productsUpserted++;
    }

    // ── Upsert customers from orders ─────────────────────────────────────────
    const customerMap = new Map<string, {
      email: string; orders_count: number; total_spent: number;
      first_order_at: string; last_order_at: string;
    }>();

    for (const order of orders) {
      const email = order.contact_email;
      if (!email) continue;
      const orderDate = order.created_at.split("T")[0];
      const total = parseFloat(order.total);
      const ex = customerMap.get(email);
      if (ex) {
        ex.orders_count++;
        ex.total_spent += total;
        if (orderDate < ex.first_order_at) ex.first_order_at = orderDate;
        if (orderDate > ex.last_order_at) ex.last_order_at = orderDate;
      } else {
        customerMap.set(email, {
          email,
          orders_count: 1,
          total_spent: total,
          first_order_at: orderDate,
          last_order_at: orderDate,
        });
      }
    }

    // Compute avg ticket for VIP threshold
    const allSpent = Array.from(customerMap.values()).map((c) => c.total_spent / c.orders_count);
    const avgTicket = allSpent.length > 0 ? allSpent.reduce((s, v) => s + v, 0) / allSpent.length : 0;

    for (const [, cust] of customerMap) {
      const segment = cust.orders_count === 1 ? "new"
        : cust.orders_count >= 5 || (avgTicket > 0 && cust.total_spent / cust.orders_count >= 3 * avgTicket)
          ? "vip" : "returning";

      await db.from("ecommerce_customers").upsert({
        external_id: cust.email,
        workspace_id: conn.workspace_id,
        client_id: conn.client_id,
        provider: "tiendanube",
        email: cust.email,
        orders_count: cust.orders_count,
        total_spent: cust.total_spent,
        first_order_at: cust.first_order_at,
        last_order_at: cust.last_order_at,
        segment,
      }, { onConflict: "workspace_id,external_id,provider" });
    }

    // ── Upsert carts ─────────────────────────────────────────────────────────
    let cartsUpserted = 0;
    for (const cart of carts) {
      const statusNorm = cart.completed_at ? "recovered" : "abandoned";
      const { error: cartErr } = await db.from("ecommerce_carts").upsert({
        external_id: String(cart.id),
        workspace_id: conn.workspace_id,
        client_id: conn.client_id,
        provider: "tiendanube",
        customer_email: cart.contact_email ?? null,
        value: parseFloat(cart.total),
        status: statusNorm,
        abandoned_at: cart.created_at,
        recovered_at: cart.completed_at ?? null,
        items: cart.products ?? null,
      }, { onConflict: "workspace_id,external_id,provider" });
      if (!cartErr) cartsUpserted++;
    }

    // ── Update connection status ──────────────────────────────────────────────
    await db.from("ecommerce_connections").update({
      status: "connected",
      last_sync_at: new Date().toISOString(),
      last_error: null,
    }).eq("id", connectionId);

    return new Response(JSON.stringify({
      success: true,
      ordersUpserted,
      productsUpserted,
      cartsUpserted,
      customersProcessed: customerMap.size,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("sync-ecommerce-daily error:", errorMsg);

    // Try to set connection status to error
    try {
      const body: SyncInput = await req.clone().json().catch(() => ({}));
      if (body.connectionId) {
        const db2 = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await db2.from("ecommerce_connections").update({
          status: "error",
          last_error: errorMsg,
        }).eq("id", body.connectionId);
      }
    } catch {}

    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Verify function directory structure**

```bash
ls /Users/lautcro/Documents/mi-proyecto/nebulab-command-center/supabase/functions/sync-ecommerce-daily/
```
Expected: `index.ts`

- [ ] **Step 3: Commit**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && git add supabase/functions/sync-ecommerce-daily/ && git commit -m "feat: add sync-ecommerce-daily edge function for Tiendanube"
```

---

### Task 3: aggregate-ecommerce-revenue edge function

**Files:**
- Create: `supabase/functions/aggregate-ecommerce-revenue/index.ts`

- [ ] **Step 1: Create the function**

```typescript
// supabase/functions/aggregate-ecommerce-revenue/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AggregateInput {
  workspaceId: string;
  dateFrom?: string;
  dateTo?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  try {
    const body: AggregateInput = await req.json();
    const { workspaceId } = body;

    if (!workspaceId) {
      return new Response(JSON.stringify({ success: false, error: "workspaceId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const dateFrom = body.dateFrom ?? today;
    const dateTo = body.dateTo ?? today;

    // Aggregate paid orders by (workspace_id, client_id, date)
    const { data: orders, error: ordersErr } = await db
      .from("ecommerce_orders")
      .select("workspace_id, client_id, date, total")
      .eq("workspace_id", workspaceId)
      .eq("status", "paid")
      .gte("date", dateFrom)
      .lte("date", dateTo);

    if (ordersErr) throw ordersErr;
    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ success: true, rowsUpdated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by (workspace_id, client_id, date)
    const grouped = new Map<string, { workspace_id: string; client_id: string; date: string; total: number }>();
    for (const order of orders) {
      const key = `${order.workspace_id}__${order.client_id}__${order.date}`;
      const ex = grouped.get(key);
      if (ex) {
        ex.total += Number(order.total);
      } else {
        grouped.set(key, {
          workspace_id: order.workspace_id,
          client_id: order.client_id,
          date: order.date,
          total: Number(order.total),
        });
      }
    }

    // UPDATE workspace_revenue_daily.source_breakdown for each (workspace_id, date)
    // We aggregate across all clients for the workspace row
    const wsDateMap = new Map<string, number>();
    for (const [, row] of grouped) {
      const key = `${row.workspace_id}__${row.date}`;
      wsDateMap.set(key, (wsDateMap.get(key) ?? 0) + row.total);
    }

    let rowsUpdated = 0;
    for (const [key, ecommerceTotal] of wsDateMap) {
      const [wsId, date] = key.split("__");

      // Fetch existing row to merge JSONB
      const { data: existing } = await db
        .from("workspace_revenue_daily")
        .select("source_breakdown")
        .eq("workspace_id", wsId)
        .eq("date", date)
        .maybeSingle();

      if (!existing) {
        // No revenue row for this date yet — skip (sync-ga4 will create it)
        continue;
      }

      const currentBreakdown = (existing.source_breakdown as Record<string, number>) ?? {};
      const newBreakdown = { ...currentBreakdown, ecommerce: ecommerceTotal };

      const { error: updateErr } = await db
        .from("workspace_revenue_daily")
        .update({ source_breakdown: newBreakdown })
        .eq("workspace_id", wsId)
        .eq("date", date);

      if (!updateErr) rowsUpdated++;
    }

    // Recompute customer segments for affected clients
    const affectedClients = new Set(Array.from(grouped.values()).map((r) => r.client_id));
    for (const clientId of affectedClients) {
      const { data: customers } = await db
        .from("ecommerce_customers")
        .select("id, orders_count, total_spent")
        .eq("client_id", clientId)
        .eq("workspace_id", workspaceId);

      if (!customers || customers.length === 0) continue;

      const totalSpents = customers.map((c) => c.total_spent / Math.max(c.orders_count, 1));
      const avgTicket = totalSpents.length > 0
        ? totalSpents.reduce((s, v) => s + v, 0) / totalSpents.length
        : 0;

      for (const cust of customers) {
        const segment = cust.orders_count === 1 ? "new"
          : cust.orders_count >= 5 || (avgTicket > 0 && cust.total_spent / Math.max(cust.orders_count, 1) >= 3 * avgTicket)
            ? "vip" : "returning";

        await db.from("ecommerce_customers")
          .update({ segment })
          .eq("id", cust.id);
      }
    }

    return new Response(JSON.stringify({ success: true, rowsUpdated, groupsProcessed: wsDateMap.size }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("aggregate-ecommerce-revenue error:", errorMsg);
    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Commit**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && git add supabase/functions/aggregate-ecommerce-revenue/ && git commit -m "feat: add aggregate-ecommerce-revenue edge function"
```

---

### Task 4: Add phases 8+9 to job-orchestrator

**Files:**
- Modify: `supabase/functions/job-orchestrator/index.ts`

- [ ] **Step 1: Add to JOB_DEFS array**

In `supabase/functions/job-orchestrator/index.ts`, find the `JOB_DEFS` array and add after the last entry (`compute_workspace_health` phase 7):

```typescript
  // Phase 8: Ecommerce sync (after all ad platform jobs)
  { name: "sync_ecommerce_daily",        provider: null, phase: 8 },
  // Phase 9: Ecommerce revenue aggregation
  { name: "aggregate_ecommerce_revenue", provider: null, phase: 9 },
```

- [ ] **Step 2: Add cases to executeJob switch**

In the `executeJob` function, after the existing `compute_workspace_health` case, add:

```typescript
    case "sync_ecommerce_daily": {
      // Iterate over all ecommerce_connections for this workspace
      const { data: connections } = await supabase
        .from("ecommerce_connections")
        .select("id")
        .eq("workspace_id", workspaceId)
        .neq("status", "disconnected");

      if (!connections || connections.length === 0) {
        return { items_upserted: 0, details: { skipped: true, reason: "no_ecommerce_connections" } };
      }

      let totalUpserted = 0;
      const errors: string[] = [];
      for (const conn of connections) {
        const resp = await fetch(
          `${supabaseUrl}/functions/v1/sync-ecommerce-daily`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ connectionId: conn.id }),
          }
        );
        if (!resp.ok) {
          errors.push(`connection ${conn.id}: HTTP ${resp.status}`);
          continue;
        }
        const data = await resp.json();
        if (data.success) {
          totalUpserted += (data.ordersUpserted ?? 0);
        } else {
          errors.push(`connection ${conn.id}: ${data.error}`);
        }
      }
      return { items_upserted: totalUpserted, details: { errors } };
    }

    case "aggregate_ecommerce_revenue": {
      const resp = await fetch(
        `${supabaseUrl}/functions/v1/aggregate-ecommerce-revenue`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ workspaceId }),
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "aggregate-ecommerce-revenue failed");
      return { items_upserted: data.rowsUpdated ?? 0, details: { groupsProcessed: data.groupsProcessed } };
    }
```

- [ ] **Step 3: Verify no TypeScript errors in the function**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && git add supabase/functions/job-orchestrator/ && git commit -m "feat(orchestrator): add phases 8+9 for ecommerce sync and revenue aggregation"
```

---

### Task 5: Update useScorecard for ecommerce revenue bridge

**Files:**
- Modify: `src/hooks/useScorecard.ts`

- [ ] **Step 1: Add source_breakdown to revQuery select**

In `src/hooks/useScorecard.ts`, find the `revQuery` definition and update the select:

Change:
```typescript
let revQuery = supabase
  .from("workspace_revenue_daily")
  .select("*")
  ...
```

To (explicit fields + source_breakdown):
```typescript
let revQuery = supabase
  .from("workspace_revenue_daily")
  .select("date, total_revenue, total_purchases, source_breakdown, client_id")
  ...
```

- [ ] **Step 2: Update effectiveRevGa4 to prefer ecommerce when available**

Find the line:
```typescript
const effectiveRevGa4 = totalRevGa4 > 0 ? totalRevGa4 : wsRevenueGa4;
```

Replace with:
```typescript
// Check if any revenue row has ecommerce data
const wsEcommerceRevenue = revenueRows.reduce((s, r) => {
  const breakdown = (r as any).source_breakdown as Record<string, number> | null;
  return s + (breakdown?.ecommerce ?? 0);
}, 0);
const effectiveRevGa4 = wsEcommerceRevenue > 0
  ? wsEcommerceRevenue
  : (totalRevGa4 > 0 ? totalRevGa4 : wsRevenueGa4);
```

Also export a flag so the UI can show the "Revenue Real" label:
Update the return type in the queryFn signature:
```typescript
queryFn: async (): Promise<{ cards: SegmentScorecard[]; totals: ScorecardTotals; prevTotals: ScorecardTotals; daily: ScorecardDaily[]; hasEcommerceRevenue: boolean }> => {
```

And add `hasEcommerceRevenue: wsEcommerceRevenue > 0` to the return object.

- [ ] **Step 3: Update Home.tsx to show "Revenue Real 🛍" label when ecommerce is active**

In `src/pages/Home.tsx`, read `hasEcommerceRevenue` from scorecard:
```typescript
const hasEcommerceRevenue = scorecard?.hasEcommerceRevenue ?? false;
```

Update the Revenue GA4 StatCard label:
```tsx
<StatCard
  icon={DollarSign}
  label={hasEcommerceRevenue ? "Revenue Real" : "Revenue GA4"}
  value={fmtCurrency(totals.revenueGa4)}
  status="success"
  hero
/>
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && git add src/hooks/useScorecard.ts src/pages/Home.tsx && git commit -m "feat: bridge ecommerce revenue to scorecard via source_breakdown JSONB"
```

---

### Task 6: Create /ecommerce page

**Files:**
- Create: `src/pages/Ecommerce.tsx`

- [ ] **Step 1: Create the page with KPI strip + 4 tabs**

```typescript
// src/pages/Ecommerce.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { format, startOfMonth } from "date-fns";
import SectionHeader from "@/components/SectionHeader";
import EmptyState from "@/components/EmptyState";
import { DeltaBadge } from "@/components/DeltaBadge";
import { fmt, fmtCurrency, fmtCompact } from "@/components/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ShoppingCart, Package, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface EcommerceOrder {
  id: string;
  external_id: string;
  date: string;
  status: string;
  total: number;
  currency: string;
  customer_email: string | null;
  items_count: number | null;
  utm_source: string | null;
}

interface EcommerceProduct {
  id: string;
  external_id: string;
  name: string;
  price: number | null;
  stock: number | null;
  category: string | null;
  is_active: boolean;
}

interface EcommerceCustomer {
  id: string;
  email: string | null;
  orders_count: number;
  total_spent: number;
  first_order_at: string | null;
  last_order_at: string | null;
  segment: string;
}

interface EcommerceCart {
  id: string;
  customer_email: string | null;
  value: number;
  status: string;
  abandoned_at: string;
  recovered_at: string | null;
}

interface EcommerceData {
  orders: EcommerceOrder[];
  products: EcommerceProduct[];
  customers: EcommerceCustomer[];
  carts: EcommerceCart[];
  // KPI summary
  revenueMtd: number;
  ordersCount: number;
  avgTicket: number;
  newCustomers: number;
  abandonedValue: number;
  abandonedCount: number;
  // Prev period KPIs
  prevRevenueMtd: number;
  prevOrdersCount: number;
  prevAvgTicket: number;
  prevNewCustomers: number;
}

function useEcommerceData() {
  const { currentWorkspace, dateRange } = useWorkspace();
  const { selectedClient } = useClient();
  const fromStr = format(dateRange.from, "yyyy-MM-dd");
  const toStr = format(dateRange.to, "yyyy-MM-dd");
  const clientId = selectedClient?.id ?? null;

  // Prev period
  const daysCount = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000) + 1;
  const prevTo = new Date(dateRange.from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - (daysCount - 1) * 86400000);
  const prevFromStr = format(prevFrom, "yyyy-MM-dd");
  const prevToStr = format(prevTo, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["ecommerce", currentWorkspace?.id, clientId, fromStr, toStr],
    queryFn: async (): Promise<EcommerceData> => {
      if (!currentWorkspace) return emptyData();

      let ordersQ = supabase
        .from("ecommerce_orders")
        .select("id, external_id, date, status, total, currency, customer_email, items_count, utm_source")
        .eq("workspace_id", currentWorkspace.id)
        .gte("date", fromStr)
        .lte("date", toStr)
        .order("date", { ascending: false })
        .limit(200);
      if (clientId) ordersQ = ordersQ.eq("client_id", clientId);

      let productsQ = supabase
        .from("ecommerce_products")
        .select("id, external_id, name, price, stock, category, is_active")
        .eq("workspace_id", currentWorkspace.id)
        .order("name");
      if (clientId) productsQ = productsQ.eq("client_id", clientId);

      let customersQ = supabase
        .from("ecommerce_customers")
        .select("id, email, orders_count, total_spent, first_order_at, last_order_at, segment")
        .eq("workspace_id", currentWorkspace.id)
        .order("total_spent", { ascending: false })
        .limit(200);
      if (clientId) customersQ = customersQ.eq("client_id", clientId);

      let cartsQ = supabase
        .from("ecommerce_carts")
        .select("id, customer_email, value, status, abandoned_at, recovered_at")
        .eq("workspace_id", currentWorkspace.id)
        .gte("abandoned_at", fromStr + "T00:00:00")
        .lte("abandoned_at", toStr + "T23:59:59")
        .order("abandoned_at", { ascending: false });
      if (clientId) cartsQ = cartsQ.eq("client_id", clientId);

      // Prev period orders for delta
      let prevOrdersQ = supabase
        .from("ecommerce_orders")
        .select("total, status, customer_email, date")
        .eq("workspace_id", currentWorkspace.id)
        .gte("date", prevFromStr)
        .lte("date", prevToStr);
      if (clientId) prevOrdersQ = prevOrdersQ.eq("client_id", clientId);

      const [ordersRes, productsRes, customersRes, cartsRes, prevOrdersRes] = await Promise.all([
        ordersQ, productsQ, customersQ, cartsQ, prevOrdersQ,
      ]);

      const orders = (ordersRes.data ?? []) as EcommerceOrder[];
      const products = (productsRes.data ?? []) as EcommerceProduct[];
      const customers = (customersRes.data ?? []) as EcommerceCustomer[];
      const carts = (cartsRes.data ?? []) as EcommerceCart[];
      const prevOrders = prevOrdersRes.data ?? [];

      // Current period KPIs
      const paidOrders = orders.filter((o) => o.status === "paid");
      const revenueMtd = paidOrders.reduce((s, o) => s + Number(o.total), 0);
      const ordersCount = paidOrders.length;
      const avgTicket = ordersCount > 0 ? revenueMtd / ordersCount : 0;
      const newCustomers = customers.filter((c) => c.segment === "new").length;
      const abandonedCarts = carts.filter((c) => c.status === "abandoned");
      const abandonedValue = abandonedCarts.reduce((s, c) => s + Number(c.value), 0);
      const abandonedCount = abandonedCarts.length;

      // Prev period KPIs
      const prevPaid = prevOrders.filter((o) => o.status === "paid");
      const prevRevenueMtd = prevPaid.reduce((s, o) => s + Number(o.total), 0);
      const prevOrdersCount = prevPaid.length;
      const prevAvgTicket = prevOrdersCount > 0 ? prevRevenueMtd / prevOrdersCount : 0;
      const prevEmails = new Set(prevOrders.map((o) => o.customer_email).filter(Boolean));
      const prevNewCustomers = prevEmails.size;

      return {
        orders, products, customers, carts,
        revenueMtd, ordersCount, avgTicket, newCustomers,
        abandonedValue, abandonedCount,
        prevRevenueMtd, prevOrdersCount, prevAvgTicket, prevNewCustomers,
      };
    },
    enabled: !!currentWorkspace,
  });
}

function emptyData(): EcommerceData {
  return {
    orders: [], products: [], customers: [], carts: [],
    revenueMtd: 0, ordersCount: 0, avgTicket: 0, newCustomers: 0,
    abandonedValue: 0, abandonedCount: 0,
    prevRevenueMtd: 0, prevOrdersCount: 0, prevAvgTicket: 0, prevNewCustomers: 0,
  };
}

// ── Status badge helpers ──────────────────────────────────────────────────────
const orderStatusConfig: Record<string, { label: string; className: string }> = {
  paid: { label: "Pagado", className: "bg-success/10 text-success" },
  pending: { label: "Pendiente", className: "bg-warning/10 text-warning" },
  cancelled: { label: "Cancelado", className: "bg-destructive/10 text-destructive" },
  refunded: { label: "Devuelto", className: "bg-muted text-muted-foreground" },
};

const segmentConfig: Record<string, { label: string; className: string }> = {
  new: { label: "Nuevo", className: "bg-info/10 text-info" },
  returning: { label: "Recurrente", className: "bg-primary/10 text-primary" },
  vip: { label: "VIP", className: "bg-warning/10 text-warning" },
};

function utmColor(source: string | null): string {
  if (!source) return "text-muted-foreground";
  if (source.toLowerCase().includes("facebook") || source.toLowerCase().includes("meta")) return "text-info";
  if (source.toLowerCase().includes("google")) return "text-success";
  return "text-muted-foreground";
}

// ── KPI strip ─────────────────────────────────────────────────────────────────
function KpiStrip({ data }: { data: EcommerceData }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border rounded-lg overflow-hidden">
      {[
        {
          label: "Revenue Real",
          value: fmtCurrency(data.revenueMtd),
          current: data.revenueMtd,
          prev: data.prevRevenueMtd,
          valueClass: "text-success",
        },
        {
          label: "Órdenes",
          value: fmt(data.ordersCount),
          current: data.ordersCount,
          prev: data.prevOrdersCount,
          valueClass: "",
        },
        {
          label: "Ticket Promedio",
          value: fmtCurrency(data.avgTicket),
          current: data.avgTicket,
          prev: data.prevAvgTicket,
          valueClass: "",
        },
        {
          label: "Clientes Nuevos",
          value: fmt(data.newCustomers),
          current: data.newCustomers,
          prev: data.prevNewCustomers,
          valueClass: "",
        },
        {
          label: "Carritos Abandon.",
          value: fmtCurrency(data.abandonedValue),
          current: 0,
          prev: 0,
          valueClass: "",
          sub: `${data.abandonedCount} carritos`,
        },
      ].map((kpi) => (
        <div key={kpi.label} className="bg-background p-4">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{kpi.label}</p>
          <p className={cn("text-xl font-bold", kpi.valueClass)}>{kpi.value}</p>
          <div className="mt-0.5">
            {kpi.sub
              ? <span className="text-[10px] text-muted-foreground">{kpi.sub}</span>
              : <DeltaBadge current={kpi.current} prev={kpi.prev} />
            }
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Órdenes ──────────────────────────────────────────────────────────────
function OrdersTab({ orders }: { orders: EcommerceOrder[] }) {
  if (orders.length === 0) return <EmptyState title="Sin órdenes" description="No hay órdenes en el período." />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">#Orden</TableHead>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs text-right">Total</TableHead>
              <TableHead className="text-xs">Estado</TableHead>
              <TableHead className="text-xs">Fuente UTM</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => {
              const statusCfg = orderStatusConfig[o.status] ?? { label: o.status, className: "text-muted-foreground" };
              return (
                <TableRow key={o.id}>
                  <TableCell className="text-xs text-muted-foreground">#{o.external_id}</TableCell>
                  <TableCell className="text-xs">{o.customer_email ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{o.date}</TableCell>
                  <TableCell className="text-xs text-right font-semibold tabular-nums text-success">
                    {fmtCurrency(o.total)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-[10px] border-0", statusCfg.className)}>
                      {statusCfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn("text-xs", utmColor(o.utm_source))}>
                    {o.utm_source ?? "Orgánico"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Tab: Productos ────────────────────────────────────────────────────────────
function ProductsTab({ products }: { products: EcommerceProduct[] }) {
  if (products.length === 0) return <EmptyState title="Sin productos" description="No hay productos sincronizados." />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Producto</TableHead>
              <TableHead className="text-xs">Categoría</TableHead>
              <TableHead className="text-xs text-right">Precio</TableHead>
              <TableHead className="text-xs text-right">Stock</TableHead>
              <TableHead className="text-xs">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-xs font-medium max-w-[200px] truncate">{p.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{p.category ?? "—"}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{p.price != null ? fmtCurrency(p.price) : "—"}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">
                  {p.stock != null
                    ? <span className={cn(p.stock <= 5 ? "text-destructive font-medium" : "text-foreground")}>{p.stock}</span>
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-[10px] border-0", p.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                    {p.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Tab: Clientes ─────────────────────────────────────────────────────────────
function CustomersTab({ customers }: { customers: EcommerceCustomer[] }) {
  if (customers.length === 0) return <EmptyState title="Sin clientes" description="No hay clientes sincronizados." />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Email</TableHead>
              <TableHead className="text-xs text-right">Órdenes</TableHead>
              <TableHead className="text-xs text-right">LTV</TableHead>
              <TableHead className="text-xs">Primera Compra</TableHead>
              <TableHead className="text-xs">Última Compra</TableHead>
              <TableHead className="text-xs">Segmento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => {
              const segCfg = segmentConfig[c.segment] ?? { label: c.segment, className: "text-muted-foreground" };
              return (
                <TableRow key={c.id}>
                  <TableCell className="text-xs">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{c.orders_count}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums font-medium">{fmtCurrency(c.total_spent)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.first_order_at ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.last_order_at ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-[10px] border-0", segCfg.className)}>
                      {segCfg.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Tab: Carritos ─────────────────────────────────────────────────────────────
function CartsTab({ carts }: { carts: EcommerceCart[] }) {
  if (carts.length === 0) return <EmptyState title="Sin carritos" description="No hay carritos abandonados en el período." />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs text-right">Valor</TableHead>
              <TableHead className="text-xs">Abandonado</TableHead>
              <TableHead className="text-xs">Recuperado</TableHead>
              <TableHead className="text-xs">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-xs">{c.customer_email ?? "Anónimo"}</TableCell>
                <TableCell className="text-xs text-right tabular-nums font-medium">{fmtCurrency(c.value)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.abandoned_at.split("T")[0]}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.recovered_at?.split("T")[0] ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-[10px] border-0",
                    c.status === "recovered" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                  )}>
                    {c.status === "recovered" ? "Recuperado" : "Abandonado"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const Ecommerce = () => {
  const { data, isLoading } = useEcommerceData();
  const { selectedClient } = useClient();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <SectionHeader badge="Ecommerce" title="Tienda Online" />
        <div className="grid grid-cols-5 gap-px bg-border rounded-lg overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  const hasData = data && data.ordersCount > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        badge="Ecommerce"
        title="Tienda Online"
        subtitle={selectedClient ? selectedClient.name : "Workspace global"}
      />

      {!hasData ? (
        <EmptyState
          title="Sin datos de ecommerce"
          description="Conectá una tienda en Client Hub → Tienda Online para empezar a sincronizar."
        />
      ) : (
        <>
          <KpiStrip data={data} />

          <Tabs defaultValue="orders">
            <TabsList className="h-9">
              <TabsTrigger value="orders" className="text-xs gap-1.5">
                <ShoppingCart className="h-3.5 w-3.5" /> Órdenes
                <Badge variant="secondary" className="text-[9px] h-4 px-1">{data.ordersCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="products" className="text-xs gap-1.5">
                <Package className="h-3.5 w-3.5" /> Productos
                <Badge variant="secondary" className="text-[9px] h-4 px-1">{data.products.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="customers" className="text-xs gap-1.5">
                <Users className="h-3.5 w-3.5" /> Clientes
                <Badge variant="secondary" className="text-[9px] h-4 px-1">{data.customers.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="carts" className="text-xs gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" /> Carritos
                <Badge variant="secondary" className="text-[9px] h-4 px-1">{data.abandonedCount}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-4">
              <OrdersTab orders={data.orders} />
            </TabsContent>
            <TabsContent value="products" className="mt-4">
              <ProductsTab products={data.products} />
            </TabsContent>
            <TabsContent value="customers" className="mt-4">
              <CustomersTab customers={data.customers} />
            </TabsContent>
            <TabsContent value="carts" className="mt-4">
              <CartsTab carts={data.carts} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default Ecommerce;
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors (if tables don't exist yet, some Supabase type errors may appear — acceptable until migration is applied)

- [ ] **Step 3: Commit**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && git add src/pages/Ecommerce.tsx && git commit -m "feat: add /ecommerce page with KPI strip + 4 tabs (orders, products, customers, carts)"
```

---

### Task 7: Register route + nav link

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppLayout.tsx`

- [ ] **Step 1: Add route to App.tsx**

In `src/App.tsx`, add import:
```typescript
import Ecommerce from "@/pages/Ecommerce";
```

Add route after the `/analytics` route:
```tsx
<Route path="/ecommerce" element={<Ecommerce />} />
```

- [ ] **Step 2: Add nav link to AppLayout.tsx**

In `src/components/AppLayout.tsx`, find the Performance section nav items. After the Analytics link, add:
```typescript
{ type: "link", to: "/ecommerce", label: "Ecommerce", icon: ShoppingCart },
```

Add `ShoppingCart` to the lucide imports if not already there.

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && git add src/App.tsx src/components/AppLayout.tsx && git commit -m "feat: register /ecommerce route and add nav link"
```

---

### Task 8: Client Hub — Tienda Online connection tab

**Files:**
- Modify: `src/pages/ClientHub.tsx`

- [ ] **Step 1: Add connection state and query**

In `src/pages/ClientHub.tsx`, add a new section after the existing tabs. Find the `<TabsList>` and add a new trigger:

```tsx
<TabsTrigger value="ecommerce" className="text-xs gap-1.5">
  <ShoppingCart className="h-3.5 w-3.5" /> Tienda Online
</TabsTrigger>
```

Add ShoppingCart to imports from lucide-react.

- [ ] **Step 2: Add EcommerceTab component inside ClientHub.tsx**

Add the component before the main `ClientHub` function:

```tsx
function EcommerceTab({ clientId, workspaceId }: { clientId: string; workspaceId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    provider: "tiendanube",
    store_url: "",
    api_key: "",
    api_secret: "",
  });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: connection, isLoading } = useQuery({
    queryKey: ["ecommerce-connection", workspaceId, clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ecommerce_connections")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("client_id", clientId)
        .eq("provider", form.provider)
        .maybeSingle();
      return data;
    },
  });

  // Pre-fill form from existing connection
  useEffect(() => {
    if (connection) {
      setForm({
        provider: connection.provider,
        store_url: connection.store_url,
        api_key: connection.api_key,
        api_secret: connection.api_secret ?? "",
      });
    }
  }, [connection]);

  const handleSave = async () => {
    if (!form.store_url || !form.api_key) {
      toast.error("Store URL y API Key son requeridos");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("ecommerce_connections").upsert({
      workspace_id: workspaceId,
      client_id: clientId,
      provider: form.provider,
      store_url: form.store_url,
      api_key: form.api_key,
      api_secret: form.api_secret || null,
      status: "disconnected",
    }, { onConflict: "workspace_id,client_id,provider" });
    setSaving(false);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Conexión guardada");
    qc.invalidateQueries({ queryKey: ["ecommerce-connection", workspaceId, clientId] });
  };

  const handleTest = async () => {
    if (!connection?.id) { toast.error("Guardá primero la conexión"); return; }
    setTesting(true);
    const { data: fnResult, error } = await supabase.functions.invoke("sync-ecommerce-daily", {
      body: { connectionId: connection.id, testOnly: true },
    });
    setTesting(false);
    if (error || !fnResult?.success) {
      toast.error(`Error: ${error?.message ?? fnResult?.error ?? "desconocido"}`);
    } else {
      toast.success(`Conexión exitosa — ${fnResult.ordersFound} órdenes encontradas`);
      qc.invalidateQueries({ queryKey: ["ecommerce-connection", workspaceId, clientId] });
    }
  };

  const statusConfig = {
    connected: { label: "Conectado", className: "bg-success/10 text-success" },
    error: { label: "Error", className: "bg-destructive/10 text-destructive" },
    disconnected: { label: "Desconectado", className: "bg-muted text-muted-foreground" },
  };
  const statusCfg = statusConfig[connection?.status as keyof typeof statusConfig] ?? statusConfig.disconnected;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Tienda Online</CardTitle>
            {connection && (
              <Badge variant="secondary" className={cn("text-xs border-0", statusCfg.className)}>
                {statusCfg.label}
              </Badge>
            )}
          </div>
          {connection?.last_sync_at && (
            <CardDescription className="text-[11px]">
              Último sync: {connection.last_sync_at.split("T")[0]}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {connection?.status === "error" && connection.last_error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{connection.last_error}</p>
            </div>
          )}

          <div>
            <Label>Plataforma</Label>
            <Select value={form.provider} onValueChange={(v) => setForm((p) => ({ ...p, provider: v }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tiendanube">Tiendanube</SelectItem>
                <SelectItem value="woocommerce" disabled>WooCommerce (próximamente)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Store ID / URL</Label>
            <Input
              className="mt-1"
              placeholder="Ej: 123456 o https://api.tiendanube.com/v1/123456"
              value={form.store_url}
              onChange={(e) => setForm((p) => ({ ...p, store_url: e.target.value }))}
            />
            <p className="text-[11px] text-muted-foreground mt-1">El Store ID numérico de tu tienda Tiendanube.</p>
          </div>

          <div>
            <Label>API Key (User Token)</Label>
            <Input
              className="mt-1"
              type="password"
              placeholder="••••••••••••••••"
              value={form.api_key}
              onChange={(e) => setForm((p) => ({ ...p, api_key: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing || !connection?.id}>
              {testing ? "Probando…" : "Probar Conexión"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

Add `useQueryClient` and `useEffect` to existing imports if not already present.

- [ ] **Step 3: Add TabsContent for ecommerce**

Add the tab content panel in the tabs section of ClientHub:
```tsx
<TabsContent value="ecommerce">
  {selectedClient && currentWorkspace ? (
    <EcommerceTab clientId={selectedClient.id} workspaceId={currentWorkspace.id} />
  ) : (
    <EmptyState title="Seleccioná un cliente" description="Seleccioná un cliente para configurar su tienda." />
  )}
</TabsContent>
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && git add src/pages/ClientHub.tsx && git commit -m "feat(client-hub): add Tienda Online tab for ecommerce connection settings"
```

---

### Task 9: Final build verification + push

- [ ] **Step 1: Full build**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && npm run build 2>&1 | tail -20
```
Expected: Build successful

- [ ] **Step 2: Push**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && git push
```

Expected: Push successful
