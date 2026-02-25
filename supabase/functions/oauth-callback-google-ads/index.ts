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
    const GOOGLE_LOGIN_CUSTOMER_ID = Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID")!;
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
  try {
    // Use Google Ads API to list accessible customers
    const cleanLoginId = loginCustomerId.replace(/-/g, "");

    // First get the list of accessible customer IDs
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

    if (listData.error) {
      console.error("listAccessibleCustomers error:", JSON.stringify(listData.error));
      // Still save MCC itself as an account
      await upsertAccount(supabase, workspaceId, integrationId, {
        customerId: cleanLoginId,
        descriptiveName: "MCC (Manager)",
        currencyCode: "USD",
        timeZone: "America/New_York",
        manager: true,
        status: "active",
      });
      return;
    }

    const resourceNames: string[] = listData.resourceNames || [];
    const customerIds = resourceNames.map((rn: string) => rn.replace("customers/", ""));

    // For each customer, get details via GoogleAdsService.SearchStream using MCC
    for (const custId of customerIds) {
      try {
        const query = `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.status FROM customer LIMIT 1`;

        const searchRes = await fetch(
          `https://googleads.googleapis.com/v18/customers/${custId}/googleAds:searchStream`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "developer-token": developerToken,
              "login-customer-id": cleanLoginId,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query }),
          }
        );

        const searchData = await searchRes.json();

        if (searchData.error || !searchData[0]?.results?.length) {
          // Account not accessible - save with blocked status
          await upsertAccount(supabase, workspaceId, integrationId, {
            customerId: custId,
            descriptiveName: `Customer ${custId}`,
            currencyCode: null,
            timeZone: null,
            manager: false,
            status: "blocked",
            errorMessage: searchData.error?.message || "Cannot access customer details",
          });
          continue;
        }

        const customer = searchData[0].results[0].customer;
        const isManager = customer.manager === true;

        // Skip manager accounts for sync purposes but still save them
        await upsertAccount(supabase, workspaceId, integrationId, {
          customerId: String(customer.id),
          descriptiveName: customer.descriptiveName || `Customer ${customer.id}`,
          currencyCode: customer.currencyCode || null,
          timeZone: customer.timeZone || null,
          manager: isManager,
          status: customer.status === 2 ? "active" : "disabled",
        });
      } catch (err) {
        console.error(`Error fetching customer ${custId}:`, err);
        await upsertAccount(supabase, workspaceId, integrationId, {
          customerId: custId,
          descriptiveName: `Customer ${custId}`,
          currencyCode: null,
          timeZone: null,
          manager: false,
          status: "blocked",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  } catch (err) {
    console.error("MCC discovery error:", err instanceof Error ? err.message : err);
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
