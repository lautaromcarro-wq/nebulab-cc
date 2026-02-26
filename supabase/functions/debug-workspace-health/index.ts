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

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspace_id");
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "workspace_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const since = sevenDaysAgo.toISOString().split("T")[0];

    // Run all queries in parallel
    const [perfResult, ga4Result, revenueResult, segmentsResult, healthResult] =
      await Promise.all([
        supabase
          .from("performance_daily")
          .select("date, provider, spend, impressions, clicks, conversions, currency")
          .eq("workspace_id", workspaceId)
          .gte("date", since)
          .order("date", { ascending: false }),
        supabase
          .from("ga4_daily")
          .select("date, revenue, purchases, currency")
          .eq("workspace_id", workspaceId)
          .gte("date", since)
          .order("date", { ascending: false }),
        supabase
          .from("workspace_revenue_daily")
          .select("date, total_revenue, total_purchases, source_breakdown, currency")
          .eq("workspace_id", workspaceId)
          .gte("date", since)
          .order("date", { ascending: false }),
        supabase
          .from("segments")
          .select("id")
          .eq("workspace_id", workspaceId),
        supabase
          .from("health_events")
          .select("check_type, message, severity, created_at")
          .eq("workspace_id", workspaceId)
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

    const perfRows = perfResult.data ?? [];
    const ga4Rows = ga4Result.data ?? [];
    const revenueRows = revenueResult.data ?? [];

    const totalSpend7d = perfRows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
    const totalRevenue7d = revenueRows.reduce((s, r) => s + (Number(r.total_revenue) || 0), 0);

    return new Response(
      JSON.stringify({
        workspace_id: workspaceId,
        period: `${since} to today`,
        performance_daily: {
          rows: perfRows.length,
          total_spend_7d: totalSpend7d,
          sample: perfRows.slice(0, 5),
        },
        ga4_daily: {
          rows: ga4Rows.length,
          sample: ga4Rows.slice(0, 5),
        },
        workspace_revenue_daily: {
          rows: revenueRows.length,
          total_revenue_7d: totalRevenue7d,
          sample: revenueRows.slice(0, 5),
        },
        segments_count: segmentsResult.data?.length ?? 0,
        recent_health_events: healthResult.data ?? [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
