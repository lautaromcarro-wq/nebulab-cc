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

    let workspaceId: string | null = null;
    let daysBack = 30;
    try {
      const body = await req.json();
      workspaceId = body.workspace_id ?? null;
      daysBack = body.days_back ?? 30;
    } catch { /* no body */ }

    // Get workspaces with connected Meta integrations
    let intQuery = supabase
      .from("integrations")
      .select("id, workspace_id")
      .eq("provider", "meta")
      .eq("status", "connected");
    if (workspaceId) intQuery = intQuery.eq("workspace_id", workspaceId);
    const { data: integrations, error: intErr } = await intQuery;
    if (intErr) throw intErr;
    if (!integrations?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No connected Meta integrations", upserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalUpserted = 0;
    const errors: string[] = [];

    for (const integration of integrations) {
      const wsId = integration.workspace_id;

      // Get credential for this integration
      const { data: cred } = await supabase
        .from("credentials")
        .select("access_token, meta_long_lived_token")
        .eq("integration_id", integration.id)
        .maybeSingle();

      const accessToken = cred?.meta_long_lived_token || cred?.access_token;
      if (!accessToken) {
        errors.push(`No credential for integration ${integration.id}`);
        continue;
      }

      // Get active ad accounts for this workspace
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, external_account_id")
        .eq("workspace_id", wsId)
        .eq("provider", "meta")
        .eq("status", "active");

      if (!accounts?.length) continue;

      // Date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      const since = startDate.toISOString().split("T")[0];
      const until = endDate.toISOString().split("T")[0];

      for (const account of accounts) {
        try {
          // Fetch account-level daily insights
          const actId = account.external_account_id.startsWith("act_")
            ? account.external_account_id
            : `act_${account.external_account_id}`;

          const fields = "spend,impressions,clicks,actions,action_values";
          const insightsUrl =
            `https://graph.facebook.com/v21.0/${actId}/insights` +
            `?fields=${fields}` +
            `&time_range={"since":"${since}","until":"${until}"}` +
            `&time_increment=1` +
            `&level=account` +
            `&limit=500` +
            `&access_token=${accessToken}`;

          const res = await fetch(insightsUrl);
          const data = await res.json();

          if (data.error) {
            errors.push(`Account ${actId}: ${data.error.message}`);
            continue;
          }

          const rows: Array<Record<string, unknown>> = [];

          for (const row of data.data ?? []) {
            const spend = parseFloat(row.spend || "0");
            const impressions = parseInt(row.impressions || "0", 10);
            const clicks = parseInt(row.clicks || "0", 10);

            // Extract purchases and revenue from actions
            let purchases = 0;
            let revenue = 0;
            for (const action of row.actions ?? []) {
              if (action.action_type === "purchase" || action.action_type === "omni_purchase") {
                purchases += parseInt(action.value || "0", 10);
              }
            }
            for (const av of row.action_values ?? []) {
              if (av.action_type === "purchase" || av.action_type === "omni_purchase") {
                revenue += parseFloat(av.value || "0");
              }
            }

            rows.push({
              workspace_id: wsId,
              account_id: account.id,
              provider: "meta",
              entity_type: "account",
              entity_id: account.id,
              date: row.date_start,
              spend,
              impressions,
              clicks,
              purchases,
              revenue,
              conversions: purchases,
            });
          }

          // Also fetch campaign-level insights for segment mapping
          const campInsightsUrl =
            `https://graph.facebook.com/v21.0/${actId}/insights` +
            `?fields=${fields},campaign_id,campaign_name` +
            `&time_range={"since":"${since}","until":"${until}"}` +
            `&time_increment=1` +
            `&level=campaign` +
            `&limit=500` +
            `&access_token=${accessToken}`;

          const campRes = await fetch(campInsightsUrl);
          const campData = await campRes.json();

          if (!campData.error && campData.data) {
            // Get/create campaign records
            for (const row of campData.data) {
              const extCampId = row.campaign_id;
              const campName = row.campaign_name || "";

              // Upsert campaign
              const { data: campRecord } = await supabase
                .from("campaigns")
                .upsert(
                  {
                    workspace_id: wsId,
                    account_id: account.id,
                    provider: "meta",
                    external_id: extCampId,
                    name: campName,
                    status: "active",
                  },
                  { onConflict: "workspace_id,provider,external_id" }
                )
                .select("id")
                .single();

              if (!campRecord) continue;

              const spend = parseFloat(row.spend || "0");
              const impressions = parseInt(row.impressions || "0", 10);
              const clicks = parseInt(row.clicks || "0", 10);

              let purchases = 0;
              let revenue = 0;
              for (const action of row.actions ?? []) {
                if (action.action_type === "purchase" || action.action_type === "omni_purchase") {
                  purchases += parseInt(action.value || "0", 10);
                }
              }
              for (const av of row.action_values ?? []) {
                if (av.action_type === "purchase" || av.action_type === "omni_purchase") {
                  revenue += parseFloat(av.value || "0");
                }
              }

              rows.push({
                workspace_id: wsId,
                account_id: account.id,
                provider: "meta",
                entity_type: "campaign",
                entity_id: campRecord.id,
                date: row.date_start,
                spend,
                impressions,
                clicks,
                purchases,
                revenue,
                conversions: purchases,
              });
            }

            // Handle pagination for campaign insights
            let nextUrl = campData.paging?.next;
            while (nextUrl) {
              const nextRes = await fetch(nextUrl);
              const nextData = await nextRes.json();
              if (nextData.error || !nextData.data) break;

              for (const row of nextData.data) {
                const extCampId = row.campaign_id;
                const campName = row.campaign_name || "";

                const { data: campRecord } = await supabase
                  .from("campaigns")
                  .upsert(
                    {
                      workspace_id: wsId,
                      account_id: account.id,
                      provider: "meta",
                      external_id: extCampId,
                      name: campName,
                      status: "active",
                    },
                    { onConflict: "workspace_id,provider,external_id" }
                  )
                  .select("id")
                  .single();

                if (!campRecord) continue;

                const spend = parseFloat(row.spend || "0");
                const impressions = parseInt(row.impressions || "0", 10);
                const clicks = parseInt(row.clicks || "0", 10);

                let purchases = 0;
                let revenue = 0;
                for (const action of row.actions ?? []) {
                  if (action.action_type === "purchase" || action.action_type === "omni_purchase") {
                    purchases += parseInt(action.value || "0", 10);
                  }
                }
                for (const av of row.action_values ?? []) {
                  if (av.action_type === "purchase" || av.action_type === "omni_purchase") {
                    revenue += parseFloat(av.value || "0");
                  }
                }

                rows.push({
                  workspace_id: wsId,
                  account_id: account.id,
                  provider: "meta",
                  entity_type: "campaign",
                  entity_id: campRecord.id,
                  date: row.date_start,
                  spend,
                  impressions,
                  clicks,
                  purchases,
                  revenue,
                  conversions: purchases,
                });
              }

              nextUrl = nextData.paging?.next;
            }
          }

          // Delete existing rows for this account in the date range, then insert
          await supabase
            .from("performance_daily")
            .delete()
            .eq("workspace_id", wsId)
            .eq("account_id", account.id)
            .eq("provider", "meta")
            .gte("date", since)
            .lte("date", until);

          // Insert in batches
          for (let i = 0; i < rows.length; i += 500) {
            const batch = rows.slice(i, i + 500);
            const { error: insertErr } = await supabase
              .from("performance_daily")
              .insert(batch);
            if (insertErr) {
              errors.push(`Insert error for ${actId}: ${insertErr.message}`);
            }
          }

          totalUpserted += rows.length;
        } catch (err) {
          errors.push(`Account ${account.external_account_id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Log sync run
      await supabase.from("sync_runs").insert({
        workspace_id: wsId,
        provider: "meta",
        integration_id: integration.id,
        job_name: "sync_meta_daily_metrics",
        status: errors.length > 0 ? "partial" : "success",
        items_upserted: totalUpserted,
        details: { days_back: daysBack, errors: errors.length > 0 ? errors : undefined },
        ended_at: new Date().toISOString(),
        triggered_by: "manual",
      });
    }

    return new Response(
      JSON.stringify({ success: true, upserted: totalUpserted, errors: errors.length > 0 ? errors : undefined }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-meta-daily error:", error);
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
