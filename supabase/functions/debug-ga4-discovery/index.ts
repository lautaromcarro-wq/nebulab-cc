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
    const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let workspaceId: string | null = null;
    let persist = false;
    try {
      const body = await req.json();
      workspaceId = body.workspace_id ?? null;
      persist = body.persist === true;
    } catch { /* no body */ }

    // Find GA4 integration
    let intQuery = supabase
      .from("integrations").select("id, workspace_id, scopes")
      .eq("provider", "ga4").eq("status", "connected");
    if (workspaceId) intQuery = intQuery.eq("workspace_id", workspaceId);
    const { data: integrations, error: intErr } = await intQuery.limit(1);
    if (intErr) throw intErr;
    if (!integrations?.length) {
      return json({ success: false, error: "No connected GA4 integration found" });
    }

    const integration = integrations[0];
    const wsId = integration.workspace_id;

    const { data: cred } = await supabase
      .from("credentials").select("access_token, refresh_token, expires_at")
      .eq("integration_id", integration.id).maybeSingle();
    if (!cred) return json({ success: false, error: "No credentials found" });

    // Refresh token if needed
    let accessToken = cred.access_token;
    if (cred.expires_at && new Date(cred.expires_at) < new Date()) {
      if (!cred.refresh_token) return json({ success: false, error: "Token expired, no refresh_token" });
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId, client_secret: clientSecret,
          refresh_token: cred.refresh_token, grant_type: "refresh_token",
        }),
      });
      const refreshData = await refreshRes.json();
      if (refreshData.error) return json({ success: false, error: `Token refresh: ${refreshData.error_description || refreshData.error}` });
      accessToken = refreshData.access_token;
      const newExpiry = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();
      await supabase.from("credentials").update({
        access_token: accessToken, expires_at: newExpiry, updated_at: new Date().toISOString(),
      }).eq("integration_id", integration.id);
    }

    // ── Check token info (scopes) ──
    let tokenScopes: string[] = [];
    try {
      const tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
      if (tokenInfoRes.ok) {
        const tokenInfo = await tokenInfoRes.json();
        tokenScopes = (tokenInfo.scope || "").split(" ");
      }
    } catch { /* best effort */ }

    // ── Try GA4 Admin API: accountSummaries ──
    let accountSummaries: any[] = [];
    let adminApiError: string | null = null;
    let adminApiStatus: number | null = null;
    
    const adminRes = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    adminApiStatus = adminRes.status;

    if (!adminRes.ok) {
      const errText = await adminRes.text();
      adminApiError = errText.substring(0, 500);
      console.error("[debug-ga4-discovery] Admin API error:", adminApiStatus, adminApiError);
      
      // Log health event
      await supabase.from("health_events").insert({
        workspace_id: wsId, check_type: "ga4_discovery_failed",
        severity: "critical", provider: "ga4",
        message: `GA4 Admin API HTTP ${adminApiStatus}: ${adminApiError.substring(0, 200)}`,
      });
    } else {
      const data = await adminRes.json();
      accountSummaries = data.accountSummaries || [];
    }

    // Extract properties from summaries
    const properties: Array<{ propertyId: string; displayName: string; accountName: string }> = [];
    for (const acctSummary of accountSummaries) {
      const accountDisplayName = acctSummary.displayName || acctSummary.account || "";
      for (const prop of acctSummary.propertySummaries || []) {
        const propertyId = (prop.property || "").replace("properties/", "");
        const displayName = prop.displayName || `Property ${propertyId}`;
        properties.push({ propertyId, displayName, accountName: accountDisplayName });
      }
    }

    // Persist if requested
    let persisted = 0;
    if (persist && properties.length > 0) {
      for (const prop of properties) {
        // Upsert into workspace_account_settings (don't overwrite is_enabled)
        const { data: existing } = await supabase
          .from("workspace_account_settings").select("id")
          .eq("workspace_id", wsId).eq("provider", "ga4")
          .eq("external_id", prop.propertyId).maybeSingle();

        if (!existing) {
          await supabase.from("workspace_account_settings").insert({
            workspace_id: wsId, provider: "ga4",
            external_id: prop.propertyId,
            account_name: prop.displayName,
            external_group_name: prop.accountName,
            is_enabled: false,
          });
        } else {
          await supabase.from("workspace_account_settings").update({
            account_name: prop.displayName,
            external_group_name: prop.accountName,
          }).eq("id", existing.id);
        }

        // Also upsert accounts table
        const { data: existingAcct } = await supabase
          .from("accounts").select("id")
          .eq("workspace_id", wsId).eq("external_account_id", prop.propertyId)
          .eq("provider", "ga4").maybeSingle();

        const accountData = {
          workspace_id: wsId, provider: "ga4" as const,
          external_account_id: prop.propertyId,
          name: prop.displayName,
          status: "active" as const,
          integration_id: integration.id,
          metadata: { ga4_account_name: prop.accountName, property_type: "ga4_property" },
        };

        if (existingAcct) {
          await supabase.from("accounts").update(accountData).eq("id", existingAcct.id);
        } else {
          await supabase.from("accounts").insert(accountData);
        }
        persisted++;
      }

      await supabase.from("sync_runs").insert({
        workspace_id: wsId, provider: "ga4",
        job_name: "ga4_property_discovery", status: "success",
        items_upserted: persisted,
        ended_at: new Date().toISOString(),
      });
    }

    return json({
      success: !adminApiError,
      workspace_id: wsId,
      integration_id: integration.id,
      scopes: integration.scopes,
      token_scopes: tokenScopes,
      admin_api_status: adminApiStatus,
      admin_api_error: adminApiError,
      accounts_listed: accountSummaries.length,
      properties_listed: properties.length,
      first_property_sample: properties[0] || null,
      all_properties: properties,
      persisted: persist ? persisted : undefined,
    });
  } catch (error) {
    console.error("debug-ga4-discovery error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
