import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      return redirectWithError(`Google denied access: ${errorParam}`);
    }
    if (!code || !stateParam) {
      return redirectWithError("Missing code or state parameter");
    }

    let workspace_id: string;
    try {
      const parsed = JSON.parse(atob(stateParam));
      workspace_id = parsed.workspace_id;
    } catch {
      return redirectWithError("Invalid state parameter");
    }

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_ADS_CLIENT_ID")!;
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")!;
    const GOOGLE_DEVELOPER_TOKEN = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")!;
    const GOOGLE_LOGIN_CUSTOMER_ID = (Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID") || "").replace(/[-\s]/g, "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const redirectUri = `${SUPABASE_URL}/functions/v1/oauth-callback-google-ads`;

    // 1. Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return redirectWithError(`Token exchange failed: ${tokenData.error_description || tokenData.error}`);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 2. Upsert integration
    const integrationId = await upsertIntegration(supabase, workspace_id, expiresAt);

    // 3. Save credentials
    await saveCredential(supabase, workspace_id, integrationId, accessToken, refreshToken, expiresAt);

    // 4. Discover MCC client accounts
    await discoverMccClients(
      supabase, accessToken, GOOGLE_DEVELOPER_TOKEN, GOOGLE_LOGIN_CUSTOMER_ID,
      workspace_id, integrationId
    );

    // 5. Log sync run
    await supabase.from("sync_runs").insert({
      workspace_id, provider: "google_ads", job_name: "oauth_google_ads_connect",
      status: "success", ended_at: new Date().toISOString(),
    });

    return redirectToApp("success");
  } catch (error) {
    console.error("Google Ads OAuth callback error:", error instanceof Error ? error.message : error);
    return redirectWithError("Internal server error");
  }
});

async function upsertIntegration(supabase: any, workspaceId: string, expiresAt: string): Promise<string> {
  const payload = {
    workspace_id: workspaceId,
    provider: "google_ads" as const,
    status: "connected" as const,
    scopes: ["adwords"],
    token_expires_at: expiresAt,
    token_health: { last_check: new Date().toISOString(), status: "ok" },
  };

  const { data: existing } = await supabase
    .from("integrations").select("id")
    .eq("workspace_id", workspaceId).eq("provider", "google_ads").maybeSingle();

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

  const now = new Date().toISOString();
  if (existing) {
    await supabase.from("credentials").update({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      updated_at: now,
    }).eq("id", existing.id);
  } else {
    await supabase.from("credentials").insert({
      workspace_id: workspaceId,
      integration_id: integrationId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    });
  }
}

async function discoverMccClients(
  supabase: any, accessToken: string, developerToken: string,
  loginCustomerId: string, workspaceId: string, integrationId: string
) {
  const cleanLoginId = loginCustomerId.replace(/[-\s]/g, "");
  console.log("[discovery] Starting MCC discovery with login_customer_id:", cleanLoginId);

  try {
    // Step 1: Sanity check — listAccessibleCustomers (just for logging)
    const listRes = await fetch(
      "https://googleads.googleapis.com/v18/customers:listAccessibleCustomers",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
        },
      }
    );
    const listData = await listRes.json();
    const accessibleIds = (listData.resourceNames || []).map((rn: string) => rn.replace("customers/", ""));
    console.log("[discovery] listAccessibleCustomers returned:", accessibleIds.length, "ids:", accessibleIds);

    // Step 2: Query customer_client on the MCC to find child accounts
    const gaqlQuery = `
      SELECT
        customer_client.client_customer,
        customer_client.descriptive_name,
        customer_client.level,
        customer_client.manager,
        customer_client.status,
        customer_client.currency_code,
        customer_client.time_zone,
        customer_client.id
      FROM customer_client
      WHERE customer_client.level <= 1
    `.trim();

    const searchRes = await fetch(
      `https://googleads.googleapis.com/v18/customers/${cleanLoginId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
          "login-customer-id": cleanLoginId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: gaqlQuery }),
      }
    );

    const searchData = await searchRes.json();

    if (searchData.error) {
      console.error("[discovery] GAQL customer_client error:", JSON.stringify(searchData.error));
      // Log full error to health_events
      await supabase.from("health_events").insert({
        workspace_id: workspaceId,
        check_type: "google_ads_discovery",
        severity: "critical",
        message: `MCC discovery failed: ${searchData.error.message || "Unknown error"}`,
        provider: "google_ads",
      });
      // Log to sync_runs
      await supabase.from("sync_runs").insert({
        workspace_id: workspaceId,
        provider: "google_ads",
        job_name: "mcc_discovery",
        status: "error",
        error_message: searchData.error.message || "GAQL query failed",
        error_code: searchData.error.status || "UNKNOWN",
        ended_at: new Date().toISOString(),
        details: {
          login_customer_id: cleanLoginId,
          response_status: searchData.error.status,
          response_headers_masked: "see edge function logs",
        },
      });
      return;
    }

    // Parse results from searchStream (array of batches)
    const allResults: any[] = [];
    for (const batch of searchData) {
      if (batch.results) {
        allResults.push(...batch.results);
      }
    }

    console.log("[discovery] customer_client returned", allResults.length, "results");

    if (allResults.length === 0) {
      console.warn("[discovery] 0 child accounts found. Full response:", JSON.stringify(searchData));
      await supabase.from("health_events").insert({
        workspace_id: workspaceId,
        check_type: "google_ads_discovery",
        severity: "warn",
        message: `MCC ${cleanLoginId}: 0 child accounts found`,
        provider: "google_ads",
      });
      await supabase.from("sync_runs").insert({
        workspace_id: workspaceId,
        provider: "google_ads",
        job_name: "mcc_discovery",
        status: "success",
        ended_at: new Date().toISOString(),
        items_upserted: 0,
        details: {
          login_customer_id: cleanLoginId,
          customers_found: 0,
          full_response: searchData,
        },
      });
      return;
    }

    // Step 3: Upsert each child account
    let upsertedCount = 0;
    const sampleAccounts: { id: string; name: string }[] = [];

    for (const result of allResults) {
      const cc = result.customerClient;
      if (!cc) continue;

      // Extract customer ID from resource name or id field
      const clientCustomerId = cc.id
        ? String(cc.id)
        : (cc.clientCustomer || "").replace("customers/", "");

      if (!clientCustomerId) continue;

      const isManager = cc.manager === true;
      const statusStr = cc.status === 2 || cc.status === "ENABLED" ? "active" : "disabled";

      await upsertAccount(supabase, workspaceId, integrationId, {
        customerId: clientCustomerId,
        descriptiveName: cc.descriptiveName || `Customer ${clientCustomerId}`,
        currencyCode: cc.currencyCode || null,
        timeZone: cc.timeZone || null,
        manager: isManager,
        status: statusStr,
      });
      upsertedCount++;

      if (sampleAccounts.length < 5) {
        sampleAccounts.push({ id: clientCustomerId, name: cc.descriptiveName || "" });
      }
    }

    console.log("[discovery] Upserted", upsertedCount, "accounts. Sample:", JSON.stringify(sampleAccounts));

    // Log success to sync_runs
    await supabase.from("sync_runs").insert({
      workspace_id: workspaceId,
      provider: "google_ads",
      job_name: "mcc_discovery",
      status: "success",
      ended_at: new Date().toISOString(),
      items_upserted: upsertedCount,
      details: {
        login_customer_id: cleanLoginId,
        customers_found: allResults.length,
        sample_accounts: sampleAccounts,
      },
    });

  } catch (err) {
    console.error("[discovery] MCC discovery error:", err instanceof Error ? err.message : err);
    await supabase.from("health_events").insert({
      workspace_id: workspaceId,
      check_type: "google_ads_discovery",
      severity: "critical",
      message: `MCC discovery exception: ${err instanceof Error ? err.message : "Unknown"}`,
      provider: "google_ads",
    }).catch(() => {});
  }
}

interface AccountInfo {
  customerId: string;
  descriptiveName: string;
  currencyCode: string | null;
  timeZone: string | null;
  manager: boolean;
  status: string;
  errorMessage?: string;
}

async function upsertAccount(
  supabase: any, workspaceId: string, integrationId: string, info: AccountInfo
) {
  const accountData = {
    workspace_id: workspaceId,
    provider: "google_ads" as const,
    external_account_id: info.customerId,
    name: info.descriptiveName,
    currency: info.currencyCode,
    timezone: info.timeZone,
    status: (info.status === "active" ? "active" : "disabled") as "active" | "disabled",
    integration_id: integrationId,
    metadata: {
      manager: info.manager,
      manager_customer_id: Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID")?.replace(/-/g, "") || null,
      enabled: !info.manager, // Managers not enabled for sync by default
      ...(info.errorMessage ? { error_message: info.errorMessage, sync_status: "blocked" } : { sync_status: "ok" }),
    },
  };

  const { data: existing } = await supabase
    .from("accounts").select("id")
    .eq("workspace_id", workspaceId)
    .eq("external_account_id", info.customerId)
    .eq("provider", "google_ads")
    .maybeSingle();

  if (existing) {
    await supabase.from("accounts").update(accountData).eq("id", existing.id);
  } else {
    await supabase.from("accounts").insert(accountData);
  }
}

function redirectToApp(status: string): Response {
  const appUrl = Deno.env.get("APP_URL") || "https://nebulab-command-center.lovable.app";
  return new Response(null, {
    status: 302,
    headers: { "Location": `${appUrl}/connections?oauth=google_ads&status=${status}` },
  });
}

function redirectWithError(message: string): Response {
  const appUrl = Deno.env.get("APP_URL") || "https://nebulab-command-center.lovable.app";
  const encodedMsg = encodeURIComponent(message);
  return new Response(null, {
    status: 302,
    headers: { "Location": `${appUrl}/connections?oauth=google_ads&status=error&message=${encodedMsg}` },
  });
}
