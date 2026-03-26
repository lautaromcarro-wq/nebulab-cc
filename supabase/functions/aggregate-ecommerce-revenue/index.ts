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
