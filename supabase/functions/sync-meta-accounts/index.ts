import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const META_API_VERSION = "v21.0";
const MAX_API_PAGES = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let workspaceId: string | null = null;
    let triggeredBy: "cron" | "manual" = "cron";
    try {
      const body = await req.json();
      workspaceId = body.workspace_id ?? null;
      triggeredBy = body.triggered_by ?? "cron";
    } catch { /* no body */ }

    // Get all connected Meta integrations
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

      // Read credentials
      const { data: cred } = await supabase
        .from("credentials")
        .select("access_token, meta_long_lived_token")
        .eq("integration_id", integration.id)
        .maybeSingle();

      const accessToken = cred?.meta_long_lived_token || cred?.access_token;
      if (!accessToken) {
        errors.push(`Workspace ${wsId}: no credential for integration ${integration.id}`);
        continue;
      }

      // Fetch all ad accounts from Meta Graph API (paginated)
      const accounts: Array<{
        id: string;
        name: string;
        account_status: number;
        currency: string;
        timezone_name: string;
      }> = [];

      let nextUrl: string | null =
        `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts` +
        `?fields=id,name,account_status,currency,timezone_name` +
        `&limit=200` +
        `&access_token=${accessToken}`;

      let pages = 0;
      while (nextUrl && pages < MAX_API_PAGES) {
        const res = await fetch(nextUrl);
        pages++;
        const data = await res.json();

        if (data.error) {
          errors.push(`Workspace ${wsId}: Meta API error ${data.error.code} — ${data.error.message}`);
          await supabase.from("health_events").insert({
            workspace_id: wsId,
            provider: "meta",
            check_type: "sync_meta_accounts",
            severity: "critical",
            message: `Failed to fetch ad accounts: ${data.error.message}`,
          });
          break;
        }

        for (const acct of data.data ?? []) {
          accounts.push(acct);
        }

        nextUrl = data.paging?.next ?? null;
      }

      if (!accounts.length) continue;

      // Upsert accounts into DB
      // Meta returns IDs like "act_1234567890"
      const rows = accounts.map((acct) => ({
        workspace_id: wsId,
        integration_id: integration.id,
        provider: "meta",
        external_account_id: acct.id.startsWith("act_") ? acct.id : `act_${acct.id}`,
        name: acct.name,
        currency: acct.currency ?? null,
        timezone: acct.timezone_name ?? null,
        // Meta account_status: 1 = ACTIVE, anything else = disabled
        status: acct.account_status === 1 ? "active" : "disabled",
        metadata: { meta_account_status: acct.account_status },
      }));

      const { error: upsertErr } = await supabase
        .from("accounts")
        .upsert(rows, { onConflict: "workspace_id,provider,external_account_id" });

      if (upsertErr) {
        errors.push(`Workspace ${wsId}: upsert error — ${upsertErr.message}`);
      } else {
        totalUpserted += rows.length;
      }

      // Log sync run
      await supabase.from("sync_runs").insert({
        workspace_id: wsId,
        provider: "meta",
        integration_id: integration.id,
        job_name: "sync_meta_accounts",
        status: errors.length ? "partial" : "success",
        items_upserted: rows.length,
        ended_at: new Date().toISOString(),
        triggered_by: triggeredBy,
        details: { accounts_found: accounts.length, pages_fetched: pages },
      });
    }

    return new Response(
      JSON.stringify({ success: true, upserted: totalUpserted, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[sync-meta-accounts] error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
