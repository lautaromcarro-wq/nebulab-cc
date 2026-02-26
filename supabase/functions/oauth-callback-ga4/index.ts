import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const correlationId = crypto.randomUUID();

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    console.log("[oauth-callback-ga4] Incoming:", JSON.stringify({
      correlation_id: correlationId, code_present: !!code,
      state_present: !!stateParam, error: errorParam,
    }));

    if (errorParam) return redirectWithError(`Google denied access: ${errorParam}`, correlationId);
    if (!code || !stateParam) return redirectWithError("Missing code or state", correlationId);

    let workspace_id: string;
    let stateCorrelationId: string | undefined;
    try {
      const parsed = JSON.parse(atob(stateParam));
      workspace_id = parsed.workspace_id;
      stateCorrelationId = parsed.correlation_id;
    } catch { return redirectWithError("Invalid state parameter", correlationId); }

    const finalCorrelationId = stateCorrelationId || correlationId;

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_ADS_CLIENT_ID")!;
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const redirectUri = `${SUPABASE_URL}/functions/v1/oauth-callback-ga4`;

    // 1. Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri, grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error("[oauth-callback-ga4] Token exchange failed:", tokenData);
      return redirectWithError(`Token exchange failed: ${tokenData.error_description || tokenData.error}`, finalCorrelationId);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 2. Upsert integration (provider = ga4)
    const integrationId = await upsertIntegration(supabase, workspace_id, expiresAt);

    // 3. Save credentials
    await saveCredential(supabase, workspace_id, integrationId, accessToken, refreshToken, expiresAt);

    // 4. Discover GA4 properties
    await discoverProperties(supabase, accessToken, workspace_id, integrationId, finalCorrelationId);

    // 5. Log sync run
    await supabase.from("sync_runs").insert({
      workspace_id, provider: "ga4", job_name: "oauth_ga4_connect",
      status: "success", ended_at: new Date().toISOString(),
    });

    return redirectToApp("success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[oauth-callback-ga4] Exception:", message);
    try {
      const sbUrl = Deno.env.get("SUPABASE_URL");
      const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (sbUrl && sbKey) {
        const sb = createClient(sbUrl, sbKey);
        await sb.from("health_events").insert({
          workspace_id: "00000000-0000-0000-0000-000000000000",
          check_type: "ga4_oauth_error", severity: "critical",
          message: `oauth-callback exception: ${message}`, provider: "ga4",
        });
      }
    } catch { /* best effort */ }
    return redirectWithError("Internal server error", correlationId);
  }
});

// ── Helpers ──

async function upsertIntegration(supabase: any, workspaceId: string, expiresAt: string): Promise<string> {
  const payload = {
    workspace_id: workspaceId, provider: "ga4" as const,
    status: "connected" as const, scopes: ["analytics.readonly"],
    token_expires_at: expiresAt,
    token_health: { last_check: new Date().toISOString(), status: "ok" },
  };

  const { data: existing } = await supabase
    .from("integrations").select("id")
    .eq("workspace_id", workspaceId).eq("provider", "ga4").maybeSingle();

  if (existing) {
    await supabase.from("integrations").update(payload).eq("id", existing.id);
    return existing.id;
  }

  const { data: newInt, error } = await supabase
    .from("integrations").insert(payload).select("id").single();
  if (error) throw new Error(`DB error: ${error.message}`);
  return newInt!.id;
}

async function saveCredential(
  supabase: any, workspaceId: string, integrationId: string,
  accessToken: string, refreshToken: string | null, expiresAt: string
) {
  const { data: existing } = await supabase
    .from("credentials").select("id").eq("integration_id", integrationId).maybeSingle();

  if (existing) {
    await supabase.from("credentials").update({
      access_token: accessToken, refresh_token: refreshToken,
      expires_at: expiresAt, updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
  } else {
    await supabase.from("credentials").insert({
      workspace_id: workspaceId, integration_id: integrationId,
      access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt,
    });
  }
}

async function discoverProperties(
  supabase: any, accessToken: string, workspaceId: string,
  integrationId: string, correlationId: string
) {
  console.log("[ga4-discovery] Listing GA4 properties:", correlationId);

  try {
    // Use GA4 Admin API to list account summaries
    const res = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[ga4-discovery] HTTP error:", res.status, errText.substring(0, 500));
      await supabase.from("health_events").insert({
        workspace_id: workspaceId, check_type: "ga4_discovery",
        severity: "critical", provider: "ga4",
        message: `GA4 discovery HTTP ${res.status}: ${errText.substring(0, 200)}`,
      });
      return;
    }

    const data = await res.json();
    const summaries = data.accountSummaries || [];

    console.log("[ga4-discovery] Found", summaries.length, "account summaries");

    let propertyCount = 0;
    const properties: Array<{ propertyId: string; displayName: string; accountName: string }> = [];

    for (const acctSummary of summaries) {
      const accountDisplayName = acctSummary.displayName || acctSummary.account || "";
      for (const prop of acctSummary.propertySummaries || []) {
        // property resource name: "properties/123456"
        const propertyId = (prop.property || "").replace("properties/", "");
        const displayName = prop.displayName || `Property ${propertyId}`;
        properties.push({ propertyId, displayName, accountName: accountDisplayName });
        propertyCount++;
      }
    }

    console.log("[ga4-discovery] Total properties:", propertyCount);

    // Store properties as accounts with provider=ga4
    for (const prop of properties) {
      const accountData = {
        workspace_id: workspaceId, provider: "ga4" as const,
        external_account_id: prop.propertyId,
        name: prop.displayName,
        status: "active" as const,
        integration_id: integrationId,
        metadata: {
          ga4_account_name: prop.accountName,
          property_type: "ga4_property",
        },
      };

      const { data: existing } = await supabase
        .from("accounts").select("id")
        .eq("workspace_id", workspaceId)
        .eq("external_account_id", prop.propertyId)
        .eq("provider", "ga4").maybeSingle();

      if (existing) {
        await supabase.from("accounts").update(accountData).eq("id", existing.id);
      } else {
        await supabase.from("accounts").insert(accountData);
      }
    }

    // Also store in workspace_account_settings for consistent UI
    for (const prop of properties) {
      const { data: existing } = await supabase
        .from("workspace_account_settings").select("id")
        .eq("workspace_id", workspaceId)
        .eq("provider", "ga4")
        .eq("external_id", prop.propertyId).maybeSingle();

      if (!existing) {
        await supabase.from("workspace_account_settings").insert({
          workspace_id: workspaceId,
          provider: "ga4",
          external_id: prop.propertyId,
          account_name: prop.displayName,
          external_group_name: prop.accountName,
          is_enabled: false,
        });
      }
    }

    await supabase.from("sync_runs").insert({
      workspace_id: workspaceId, provider: "ga4",
      job_name: "ga4_property_discovery", status: "success",
      items_upserted: propertyCount,
      ended_at: new Date().toISOString(),
      details: { correlation_id: correlationId, properties_found: propertyCount },
    });

    if (propertyCount === 0) {
      await supabase.from("health_events").insert({
        workspace_id: workspaceId, check_type: "ga4_discovery",
        severity: "warn", provider: "ga4",
        message: "No GA4 properties found for this Google account",
      });
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[ga4-discovery] Error:", errMsg);
    await supabase.from("health_events").insert({
      workspace_id: workspaceId, check_type: "ga4_discovery",
      severity: "critical", provider: "ga4",
      message: `GA4 discovery exception: ${errMsg}`,
    });
  }
}

function redirectToApp(status: string, correlationId?: string): Response {
  const appUrl = Deno.env.get("APP_URL") || "https://nebulab-command-center.lovable.app";
  let loc = `${appUrl}/connections?oauth=ga4&status=${status}`;
  if (correlationId) loc += `&correlation_id=${correlationId}`;
  return new Response(null, { status: 302, headers: { "Location": loc } });
}

function redirectWithError(message: string, correlationId?: string): Response {
  const appUrl = Deno.env.get("APP_URL") || "https://nebulab-command-center.lovable.app";
  let loc = `${appUrl}/connections?oauth=ga4&status=error&message=${encodeURIComponent(message)}`;
  if (correlationId) loc += `&correlation_id=${correlationId}`;
  return new Response(null, { status: 302, headers: { "Location": loc } });
}
