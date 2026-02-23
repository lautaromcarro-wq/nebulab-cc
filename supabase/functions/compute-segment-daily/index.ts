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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Parse optional workspace_id filter
    let workspaceFilter: string | null = null;
    try {
      const body = await req.json();
      workspaceFilter = body.workspace_id ?? null;
    } catch {
      // no body is fine
    }

    // Rolling 30d window
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split("T")[0];

    // Get workspaces
    let wsQuery = supabase
      .from("workspaces")
      .select("id, currency")
      .eq("status", "active");
    if (workspaceFilter) wsQuery = wsQuery.eq("id", workspaceFilter);
    const { data: workspaces, error: wsErr } = await wsQuery;
    if (wsErr) throw wsErr;

    let totalUpserted = 0;

    for (const ws of workspaces ?? []) {
      // Get assigned campaign mappings (exclude conflicts and unassigned)
      const { data: mappings, error: mapErr } = await supabase
        .from("campaign_segment_map")
        .select("campaign_id, segment_id, platform")
        .eq("workspace_id", ws.id)
        .eq("match_status", "assigned");
      if (mapErr) throw mapErr;
      if (!mappings?.length) continue;

      // Build lookup: campaign_id -> { segment_id, platform }
      const campaignMap = new Map<
        string,
        { segment_id: string; platform: string }
      >();
      for (const m of mappings) {
        if (m.segment_id) {
          campaignMap.set(m.campaign_id, {
            segment_id: m.segment_id,
            platform: m.platform,
          });
        }
      }

      const campaignIds = [...campaignMap.keys()];
      if (!campaignIds.length) continue;

      // Fetch performance_daily for these campaigns in rolling 30d
      // Process in batches to avoid query limits
      const allPerf: Array<{
        entity_id: string;
        date: string;
        spend: number;
        clicks: number;
        impressions: number;
        purchases: number;
        revenue: number;
        provider: string;
      }> = [];

      for (let i = 0; i < campaignIds.length; i += 100) {
        const batch = campaignIds.slice(i, i + 100);
        const { data: perf, error: perfErr } = await supabase
          .from("performance_daily")
          .select(
            "entity_id, date, spend, clicks, impressions, purchases, revenue, provider"
          )
          .eq("workspace_id", ws.id)
          .eq("entity_type", "campaign")
          .in("entity_id", batch)
          .gte("date", startDate);
        if (perfErr) throw perfErr;
        if (perf) allPerf.push(...perf);
      }

      // Also fetch GA4 data (entity_type = platform_total or account level)
      // GA4 revenue comes from performance_daily with provider=ga4
      const { data: ga4Data, error: ga4Err } = await supabase
        .from("performance_daily")
        .select("entity_id, date, revenue, provider")
        .eq("workspace_id", ws.id)
        .eq("provider", "ga4")
        .eq("entity_type", "campaign")
        .gte("date", startDate);
      if (ga4Err) throw ga4Err;

      // Build GA4 revenue lookup: `${campaign_id}_${date}` -> revenue
      const ga4RevMap = new Map<string, number>();
      for (const g of ga4Data ?? []) {
        if (g.entity_id) {
          const key = `${g.entity_id}_${g.date}`;
          ga4RevMap.set(key, (ga4RevMap.get(key) ?? 0) + Number(g.revenue ?? 0));
        }
      }

      // Aggregate by segment_id + date
      const agg = new Map<
        string,
        {
          workspace_id: string;
          segment_id: string;
          date: string;
          currency: string;
          spend: number;
          spend_meta: number;
          spend_google: number;
          clicks: number;
          impressions: number;
          purchases: number;
          revenue_platform: number;
          revenue_ga4: number;
        }
      >();

      for (const row of allPerf) {
        if (!row.entity_id) continue;
        const mapping = campaignMap.get(row.entity_id);
        if (!mapping) continue;
        // Skip ga4 rows from platform aggregation (handled separately)
        if (row.provider === "ga4") continue;

        const key = `${mapping.segment_id}_${row.date}`;
        let entry = agg.get(key);
        if (!entry) {
          entry = {
            workspace_id: ws.id,
            segment_id: mapping.segment_id,
            date: row.date,
            currency: ws.currency,
            spend: 0,
            spend_meta: 0,
            spend_google: 0,
            clicks: 0,
            impressions: 0,
            purchases: 0,
            revenue_platform: 0,
            revenue_ga4: 0,
          };
          agg.set(key, entry);
        }

        const spend = Number(row.spend ?? 0);
        entry.spend += spend;
        entry.clicks += Number(row.clicks ?? 0);
        entry.impressions += Number(row.impressions ?? 0);
        entry.purchases += Number(row.purchases ?? 0);
        entry.revenue_platform += Number(row.revenue ?? 0);

        if (mapping.platform === "meta") {
          entry.spend_meta += spend;
        } else if (mapping.platform === "google_ads") {
          entry.spend_google += spend;
        }

        // Add GA4 revenue if available
        const ga4Key = `${row.entity_id}_${row.date}`;
        const ga4Rev = ga4RevMap.get(ga4Key);
        if (ga4Rev !== undefined) {
          entry.revenue_ga4 += ga4Rev;
          // Remove to avoid double counting across campaigns in same segment+date
          ga4RevMap.delete(ga4Key);
        }
      }

      // Upsert segment_daily
      const rows = [...agg.values()];
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error: upsertErr } = await supabase
          .from("segment_daily")
          .upsert(batch, {
            onConflict: "workspace_id,segment_id,date",
          });
        if (upsertErr) throw upsertErr;
      }

      totalUpserted += rows.length;

      // Log sync run
      await supabase.from("sync_runs").insert({
        workspace_id: ws.id,
        provider: "meta",
        job_name: "compute_segment_daily",
        status: "success",
        items_upserted: rows.length,
        details: { start_date: startDate, segments_with_data: agg.size },
        ended_at: new Date().toISOString(),
        triggered_by: "cron",
      });
    }

    return new Response(
      JSON.stringify({ success: true, upserted: totalUpserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("compute_segment_daily error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
