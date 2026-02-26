import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { workspace_id, days_back = 7 } = await req.json().catch(() => ({}));

    // Get all active workspaces or just the specified one
    let workspaceIds: string[] = [];
    if (workspace_id) {
      workspaceIds = [workspace_id];
    } else {
      const { data: ws } = await supabase
        .from("workspaces")
        .select("id")
        .eq("status", "active");
      workspaceIds = (ws ?? []).map((w: any) => w.id);
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days_back);
    const startStr = startDate.toISOString().split("T")[0];

    let totalUpserted = 0;
    const errors: string[] = [];

    for (const wsId of workspaceIds) {
      try {
        // Get workspace currency
        const { data: wsData } = await supabase
          .from("workspaces")
          .select("currency")
          .eq("id", wsId)
          .single();
        const wsCurrency = wsData?.currency ?? "ARS";

        // 1) Aggregate GA4 daily revenue by date
        const { data: ga4Rows } = await supabase
          .from("ga4_daily")
          .select("date, revenue, purchases, currency")
          .eq("workspace_id", wsId)
          .gte("date", startStr);

        // 2) Check currency mismatches from GA4
        for (const row of ga4Rows ?? []) {
          if (row.currency && row.currency !== wsCurrency) {
            await supabase.from("health_events").insert({
              workspace_id: wsId,
              check_type: "currency_mismatch_warning",
              message: `GA4 revenue in ${row.currency} but workspace expects ${wsCurrency} (date: ${row.date})`,
              severity: "warn",
            });
          }
        }

        // 3) Check currency mismatches from performance_daily (Meta/Google spend)
        const { data: perfRows } = await supabase
          .from("performance_daily")
          .select("date, spend, provider, currency, revenue")
          .eq("workspace_id", wsId)
          .gte("date", startStr);

        for (const row of perfRows ?? []) {
          if (row.currency && row.currency !== wsCurrency) {
            await supabase.from("health_events").insert({
              workspace_id: wsId,
              check_type: "currency_mismatch_warning",
              message: `${row.provider} performance in ${row.currency} but workspace expects ${wsCurrency} (date: ${row.date})`,
              severity: "warn",
            });
          }
        }

        // 4) Group GA4 by date
        const byDate = new Map<string, { revenue: number; purchases: number }>();
        for (const row of ga4Rows ?? []) {
          const existing = byDate.get(row.date) ?? { revenue: 0, purchases: 0 };
          existing.revenue += Number(row.revenue) || 0;
          existing.purchases += Number(row.purchases) || 0;
          byDate.set(row.date, existing);
        }

        // 5) Build source breakdown from performance_daily
        const spendByDateProvider = new Map<string, Record<string, number>>();
        for (const row of perfRows ?? []) {
          const existing = spendByDateProvider.get(row.date) ?? {};
          const provider = row.provider ?? "unknown";
          existing[provider] = (existing[provider] ?? 0) + (Number(row.spend) || 0);
          spendByDateProvider.set(row.date, existing);
        }

        // 6) Merge all dates
        const allDates = new Set([...byDate.keys(), ...spendByDateProvider.keys()]);

        for (const date of allDates) {
          const ga4 = byDate.get(date) ?? { revenue: 0, purchases: 0 };
          const breakdown = spendByDateProvider.get(date) ?? {};

          const { error: upsertErr } = await supabase
            .from("workspace_revenue_daily")
            .upsert(
              {
                workspace_id: wsId,
                date,
                total_revenue: ga4.revenue,
                total_purchases: ga4.purchases,
                source_breakdown: breakdown,
                currency: wsCurrency,
              },
              { onConflict: "workspace_id,date" }
            );

          if (upsertErr) {
            errors.push(`${wsId}/${date}: ${upsertErr.message}`);
          } else {
            totalUpserted++;
          }
        }

        // Log success health event
        await supabase.from("health_events").insert({
          workspace_id: wsId,
          check_type: "revenue_aggregation_ok",
          message: `Revenue aggregated: ${allDates.size} days, ${ga4Rows?.length ?? 0} GA4 rows`,
          severity: "info",
        });
      } catch (err) {
        errors.push(`${wsId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        upserted: totalUpserted,
        workspaces: workspaceIds.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
