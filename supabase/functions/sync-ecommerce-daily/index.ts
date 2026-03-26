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
