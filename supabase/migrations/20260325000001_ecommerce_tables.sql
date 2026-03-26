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
