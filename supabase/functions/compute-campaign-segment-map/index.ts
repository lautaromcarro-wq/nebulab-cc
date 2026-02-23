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

interface Campaign {
  id: string;
  workspace_id: string;
  provider: "meta" | "google_ads";
  account_id: string;
  name: string;
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
      try {
        return new RegExp(rule.rule_value, "i").test(campaignName);
      } catch {
        return false;
      }
    case "in_list": {
      const items = rule.rule_value
        .split(",")
        .map((s) => s.trim().toLowerCase());
      return items.includes(name);
    }
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

    // Parse optional workspace_id filter
    let workspaceFilter: string | null = null;
    try {
      const body = await req.json();
      workspaceFilter = body.workspace_id ?? null;
    } catch {
      // no body is fine
    }

    // Get all workspaces (or filtered)
    let wsQuery = supabase
      .from("workspaces")
      .select("id")
      .eq("status", "active");
    if (workspaceFilter) wsQuery = wsQuery.eq("id", workspaceFilter);
    const { data: workspaces, error: wsErr } = await wsQuery;
    if (wsErr) throw wsErr;

    let totalProcessed = 0;
    let totalConflicts = 0;
    let totalUnassigned = 0;

    for (const ws of workspaces ?? []) {
      // Fetch rules for this workspace
      const { data: rules, error: rulesErr } = await supabase
        .from("segment_rules")
        .select("id, segment_id, platform, rule_type, rule_value, priority, is_inclusive")
        .eq("workspace_id", ws.id)
        .order("priority", { ascending: true });
      if (rulesErr) throw rulesErr;

      // Fetch campaigns (meta + google_ads only)
      const { data: campaigns, error: campErr } = await supabase
        .from("campaigns")
        .select("id, workspace_id, provider, account_id, name")
        .eq("workspace_id", ws.id)
        .in("provider", ["meta", "google_ads"]);
      if (campErr) throw campErr;

      if (!campaigns?.length) continue;

      const mappings: Array<{
        workspace_id: string;
        platform: string;
        account_id: string;
        campaign_id: string;
        segment_id: string | null;
        match_status: string;
        matched_rules: Array<{ rule_id: string; segment_id: string }>;
        computed_at: string;
      }> = [];

      const now = new Date().toISOString();

      for (const camp of campaigns) {
        // Find all matching rules for this campaign
        const applicableRules = (rules ?? []).filter(
          (r) =>
            r.is_inclusive &&
            (r.platform === "any" || r.platform === camp.provider)
        );

        const matched = applicableRules.filter((r) =>
          matchesRule(camp.name, r as SegmentRule)
        );

        // Dedupe by segment_id
        const segmentIds = [...new Set(matched.map((m) => m.segment_id))];

        let match_status: string;
        let segment_id: string | null;
        let matched_rules_json: Array<{ rule_id: string; segment_id: string }>;

        if (segmentIds.length === 0) {
          match_status = "unassigned";
          segment_id = null;
          matched_rules_json = [];
          totalUnassigned++;
        } else if (segmentIds.length === 1) {
          match_status = "assigned";
          segment_id = segmentIds[0];
          matched_rules_json = matched.map((m) => ({
            rule_id: m.id,
            segment_id: m.segment_id,
          }));
        } else {
          match_status = "conflict";
          segment_id = null;
          matched_rules_json = matched.map((m) => ({
            rule_id: m.id,
            segment_id: m.segment_id,
          }));
          totalConflicts++;
        }

        mappings.push({
          workspace_id: ws.id,
          platform: camp.provider,
          account_id: camp.account_id,
          campaign_id: camp.id,
          segment_id,
          match_status,
          matched_rules: matched_rules_json,
          computed_at: now,
        });
      }

      // Upsert in batches of 500
      for (let i = 0; i < mappings.length; i += 500) {
        const batch = mappings.slice(i, i + 500);
        const { error: upsertErr } = await supabase
          .from("campaign_segment_map")
          .upsert(batch, {
            onConflict: "workspace_id,platform,campaign_id",
          });
        if (upsertErr) throw upsertErr;
      }

      totalProcessed += mappings.length;

      // Log sync run
      await supabase.from("sync_runs").insert({
        workspace_id: ws.id,
        provider: "meta", // generic, covers both
        job_name: "compute_campaign_segment_map",
        status: "success",
        items_upserted: mappings.length,
        details: {
          conflicts: totalConflicts,
          unassigned: totalUnassigned,
        },
        ended_at: new Date().toISOString(),
        triggered_by: "cron",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        conflicts: totalConflicts,
        unassigned: totalUnassigned,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("compute_campaign_segment_map error:", error);
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
