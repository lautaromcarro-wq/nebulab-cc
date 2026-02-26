import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspace_id } = await req.json();
    if (!workspace_id) throw new Error("workspace_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const d1 = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    let score = 100;
    const penalties: Array<{ rule: string; points: number; detail: string }> = [];

    function penalize(rule: string, points: number, detail: string) {
      score = Math.max(0, score - points);
      penalties.push({ rule, points, detail });
    }

    // 1. GA4 revenue = 0 with spend > 0 yesterday
    const [revRes, spendRes] = await Promise.all([
      supabase.from("workspace_revenue_daily")
        .select("total_revenue")
        .eq("workspace_id", workspace_id)
        .eq("date", d1)
        .maybeSingle(),
      supabase.from("segment_daily")
        .select("spend")
        .eq("workspace_id", workspace_id)
        .eq("date", d1),
    ]);

    const yesterdayRev = Number(revRes.data?.total_revenue) || 0;
    const yesterdaySpend = (spendRes.data ?? []).reduce((s: number, r: any) => s + (Number(r.spend) || 0), 0);
    if (yesterdaySpend > 0 && yesterdayRev === 0) {
      penalize("ga4_zero_revenue_with_spend", 25, `Spend ${yesterdaySpend} but GA4 revenue 0 on ${d1}`);
      await supabase.from("health_events").insert({
        workspace_id, check_type: "ga4_zero_revenue", severity: "critical",
        message: `GA4 revenue = 0 with spend = ${yesterdaySpend} on ${d1}`,
      });
    }

    // 2. Segment overpacing
    const { data: segments } = await supabase
      .from("segments")
      .select("id, name, monthly_budget, tolerance_percent")
      .eq("workspace_id", workspace_id)
      .eq("status", "active");

    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    for (const seg of segments ?? []) {
      if (!seg.monthly_budget || seg.monthly_budget <= 0) continue;
      const { data: segRows } = await supabase
        .from("segment_daily")
        .select("spend, date")
        .eq("workspace_id", workspace_id)
        .eq("segment_id", seg.id)
        .gte("date", firstOfMonth)
        .lte("date", today);

      const totalSpend = (segRows ?? []).reduce((s: number, r: any) => s + (Number(r.spend) || 0), 0);
      const uniqueDays = new Set((segRows ?? []).map((r: any) => r.date)).size;
      if (uniqueDays === 0) continue;
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const projected = (totalSpend / uniqueDays) * daysInMonth;
      const tolerance = Number(seg.tolerance_percent) || 0.07;
      const ratio = projected / seg.monthly_budget;
      if (ratio > 1 + tolerance) {
        penalize("segment_overpacing", 15, `${seg.name}: projected ${projected.toFixed(0)} vs budget ${seg.monthly_budget}`);
      }
    }

    // 3. Revenue trend 7d vs 30d
    const [rev7Res, rev30Res] = await Promise.all([
      supabase.from("workspace_revenue_daily")
        .select("total_revenue")
        .eq("workspace_id", workspace_id)
        .gte("date", d7),
      supabase.from("workspace_revenue_daily")
        .select("total_revenue")
        .eq("workspace_id", workspace_id)
        .gte("date", d30),
    ]);

    const rev7 = (rev7Res.data ?? []).reduce((s: number, r: any) => s + (Number(r.total_revenue) || 0), 0);
    const rev30 = (rev30Res.data ?? []).reduce((s: number, r: any) => s + (Number(r.total_revenue) || 0), 0);
    if (rev30 > 0) {
      const avg30daily = rev30 / 30;
      const avg7daily = rev7 / 7;
      if (avg30daily > 0 && avg7daily < avg30daily * 0.6) {
        penalize("revenue_declining", 20, `7d avg ${avg7daily.toFixed(0)}/d vs 30d avg ${avg30daily.toFixed(0)}/d`);
      }
    }

    // 4. No changelog entries in 7 days
    const { count: changeCount } = await supabase
      .from("changelog")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace_id)
      .gte("created_at", new Date(now.getTime() - 7 * 86400000).toISOString());

    if ((changeCount ?? 0) === 0) {
      penalize("no_changes_7d", 10, "No changelog entries in last 7 days");
    }

    // 5. Integration health
    const { data: integrations } = await supabase
      .from("integrations")
      .select("provider, status")
      .eq("workspace_id", workspace_id);

    for (const integ of integrations ?? []) {
      if (integ.status === "degraded") {
        penalize("integration_degraded", 20, `${integ.provider} is degraded`);
      } else if (integ.status === "disconnected") {
        penalize("integration_disconnected", 15, `${integ.provider} is disconnected`);
      }
    }

    // Determine status
    const status = score >= 80 ? "healthy" : score >= 50 ? "attention" : "critical";

    // Upsert workspace_health
    await supabase.from("workspace_health").upsert({
      workspace_id,
      score,
      status,
      penalties,
      computed_at: now.toISOString(),
    }, { onConflict: "workspace_id" });

    return new Response(JSON.stringify({ success: true, score, status, penalties }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
