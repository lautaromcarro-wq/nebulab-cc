import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SegmentRule {
  id: string;
  segment_id: string;
  platform: "meta" | "google_ads" | "any";
  rule_type: "contains" | "starts_with" | "regex" | "in_list";
  rule_value: string;
  priority: number;
  is_inclusive: boolean;
}

function matchesRule(campaignName: string, rule: SegmentRule): boolean {
  const name = campaignName.toLowerCase();
  const value = rule.rule_value.toLowerCase();
  switch (rule.rule_type) {
    case "contains":
      return name.includes(value);
    case "starts_with":
      return name.startsWith(value);
    case "regex":
      try { return new RegExp(rule.rule_value, "i").test(campaignName); }
      catch { return false; }
    case "in_list":
      return rule.rule_value.split(",").map(s => s.trim().toLowerCase()).includes(name);
    default:
      return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let workspaceFilter: string | null = null;
    let daysBack = 30;
    try {
      const body = await req.json();
      workspaceFilter = body.workspace_id ?? null;
      if (body.days_back) daysBack = Number(body.days_back);
    } catch { /* no body */ }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startStr = startDate.toISOString().split("T")[0];

    // Get workspaces
    let wsQuery = supabase.from("workspaces").select("id, currency").eq("status", "active");
    if (workspaceFilter) wsQuery = wsQuery.eq("id", workspaceFilter);
    const { data: workspaces, error: wsErr } = await wsQuery;
    if (wsErr) throw wsErr;

    let totalUpserted = 0;
    let totalConflicts = 0;

    for (const ws of workspaces ?? []) {
      // 1. Fetch segment rules
      const { data: rules, error: rulesErr } = await supabase
        .from("segment_rules")
        .select("id, segment_id, platform, rule_type, rule_value, priority, is_inclusive")
        .eq("workspace_id", ws.id)
        .order("priority", { ascending: true });
      if (rulesErr) throw rulesErr;
      if (!rules?.length) continue;

      // 2. Fetch campaigns
      const { data: campaigns, error: campErr } = await supabase
        .from("campaigns")
        .select("id, name, provider")
        .eq("workspace_id", ws.id)
        .in("provider", ["meta", "google_ads"]);
      if (campErr) throw campErr;
      if (!campaigns?.length) continue;

      // 3. Match campaigns to segments (inline rule application)
      const campaignSegmentMap = new Map<string, { segmentId: string; platform: string }>();
      const conflictCampaigns: Array<{ campaignId: string; campaignName: string; matchedSegments: string[] }> = [];

      for (const camp of campaigns) {
        const inclusiveRules = (rules as SegmentRule[]).filter(
          r => r.is_inclusive && (r.platform === "any" || r.platform === camp.provider)
        );
        const matched = inclusiveRules.filter(r => matchesRule(camp.name, r));
        const segmentIds = [...new Set(matched.map(m => m.segment_id))];

        if (segmentIds.length === 1) {
          campaignSegmentMap.set(camp.id, { segmentId: segmentIds[0], platform: camp.provider });
        } else if (segmentIds.length > 1) {
          conflictCampaigns.push({ campaignId: camp.id, campaignName: camp.name, matchedSegments: segmentIds });
        }
        // unassigned (0) → skip
      }

      // 4. Log conflicts to health_events
      if (conflictCampaigns.length > 0) {
        totalConflicts += conflictCampaigns.length;
        const healthRows = conflictCampaigns.map(c => ({
          workspace_id: ws.id,
          check_type: "segment_conflict",
          severity: "warn" as const,
          entity_type: "campaign" as const,
          entity_id: c.campaignId,
          message: `Campaign "${c.campaignName}" matches ${c.matchedSegments.length} segments: ${c.matchedSegments.join(", ")}`,
          resolved: false,
        }));
        // Resolve old conflicts first
        await supabase
          .from("health_events")
          .update({ resolved: true })
          .eq("workspace_id", ws.id)
          .eq("check_type", "segment_conflict")
          .eq("resolved", false);
        // Insert new
        const { error: heErr } = await supabase.from("health_events").insert(healthRows);
        if (heErr) console.error("health_events insert error:", heErr);
      }

      // 5. Fetch performance_daily for assigned campaigns
      const assignedCampaignIds = [...campaignSegmentMap.keys()];
      if (!assignedCampaignIds.length) continue;

      const allPerf: Array<{
        entity_id: string; date: string; spend: number; clicks: number;
        impressions: number; purchases: number; revenue: number; provider: string;
      }> = [];

      for (let i = 0; i < assignedCampaignIds.length; i += 100) {
        const batch = assignedCampaignIds.slice(i, i + 100);
        const { data: perf, error: perfErr } = await supabase
          .from("performance_daily")
          .select("entity_id, date, spend, clicks, impressions, purchases, revenue, provider")
          .eq("workspace_id", ws.id)
          .eq("entity_type", "campaign")
          .in("entity_id", batch)
          .gte("date", startStr);
        if (perfErr) throw perfErr;
        if (perf) allPerf.push(...perf);
      }

      // 6. Aggregate by segment_id + date
      const agg = new Map<string, {
        workspace_id: string; segment_id: string; date: string; currency: string;
        spend: number; spend_meta: number; spend_google: number;
        clicks: number; impressions: number; purchases: number;
        revenue_platform: number; revenue_ga4: number;
      }>();

      for (const row of allPerf) {
        if (!row.entity_id) continue;
        const mapping = campaignSegmentMap.get(row.entity_id);
        if (!mapping) continue;
        if (row.provider === "ga4") continue; // handled separately if needed

        const key = `${mapping.segmentId}_${row.date}`;
        let entry = agg.get(key);
        if (!entry) {
          entry = {
            workspace_id: ws.id, segment_id: mapping.segmentId, date: row.date,
            currency: ws.currency, spend: 0, spend_meta: 0, spend_google: 0,
            clicks: 0, impressions: 0, purchases: 0, revenue_platform: 0, revenue_ga4: 0,
          };
          agg.set(key, entry);
        }

        const spend = Number(row.spend ?? 0);
        entry.spend += spend;
        entry.clicks += Number(row.clicks ?? 0);
        entry.impressions += Number(row.impressions ?? 0);
        entry.purchases += Number(row.purchases ?? 0);
        entry.revenue_platform += Number(row.revenue ?? 0);

        if (mapping.platform === "meta") entry.spend_meta += spend;
        else if (mapping.platform === "google_ads") entry.spend_google += spend;
      }

      // 7. Upsert segment_daily
      const rows = [...agg.values()];
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error: upsertErr } = await supabase
          .from("segment_daily")
          .upsert(batch, { onConflict: "workspace_id,segment_id,date" });
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
        details: { start_date: startStr, conflicts: conflictCampaigns.length, campaigns_assigned: assignedCampaignIds.length },
        ended_at: new Date().toISOString(),
        triggered_by: "cron",
      });
    }

    return new Response(
      JSON.stringify({ success: true, upserted: totalUpserted, conflicts: totalConflicts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("compute_segment_daily error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
