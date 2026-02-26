import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const API_VERSION = "v22";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")!;
    const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")!;
    const loginCustomerId = (Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID") || "").replace(/\D/g, "");

    const supabase = createClient(supabaseUrl, serviceKey);

    let workspaceId: string | null = null;
    let persist = false;
    try {
      const body = await req.json();
      workspaceId = body.workspace_id ?? null;
      persist = body.persist === true;
    } catch { /* no body */ }

    // Find the integration + credential
    let intQuery = supabase
      .from("integrations")
      .select("id, workspace_id")
      .eq("provider", "google_ads")
      .eq("status", "connected");
    if (workspaceId) intQuery = intQuery.eq("workspace_id", workspaceId);
    const { data: integrations, error: intErr } = await intQuery.limit(1);
    if (intErr) throw intErr;
    if (!integrations?.length) {
      return json({ success: false, error: "No connected Google Ads integration found" });
    }

    const integration = integrations[0];
    const wsId = integration.workspace_id;

    const { data: cred } = await supabase
      .from("credentials")
      .select("access_token, refresh_token, expires_at")
      .eq("integration_id", integration.id)
      .maybeSingle();

    if (!cred) {
      return json({ success: false, error: "No credentials found for integration" });
    }

    // Refresh token if needed
    let accessToken = cred.access_token;
    if (cred.expires_at && new Date(cred.expires_at) < new Date()) {
      if (!cred.refresh_token) {
        return json({ success: false, error: "Token expired and no refresh_token" });
      }
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: cred.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const refreshData = await refreshRes.json();
      if (refreshData.error) {
        return json({ success: false, error: `Token refresh failed: ${refreshData.error_description || refreshData.error}` });
      }
      accessToken = refreshData.access_token;
      // Update stored token
      const newExpiry = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();
      await supabase.from("credentials").update({
        access_token: accessToken,
        expires_at: newExpiry,
        updated_at: new Date().toISOString(),
      }).eq("integration_id", integration.id);
    }

    const result: Record<string, unknown> = {
      api_version: API_VERSION,
      login_customer_id: loginCustomerId,
      workspace_id: wsId,
      integration_id: integration.id,
    };

    // ── Step 1: ListAccessibleCustomers ──
    const listUrl = `https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`;
    const listRes = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
      },
    });

    const listContentType = listRes.headers.get("content-type") || "";
    if (!listRes.ok || !listContentType.includes("application/json")) {
      const text = await listRes.text();
      result.listAccessibleCustomers = {
        status: listRes.status,
        error: text.substring(0, 500),
        content_type: listContentType,
      };
    } else {
      const listData = await listRes.json();
      const resourceNames = listData.resourceNames || [];
      const accessibleIds = resourceNames.map((rn: string) => rn.replace("customers/", ""));
      result.listAccessibleCustomers = {
        status: listRes.status,
        count: accessibleIds.length,
        customer_ids: accessibleIds.slice(0, 20),
      };
    }

    // ── Step 2: customer_client GAQL via searchStream ──
    if (loginCustomerId) {
      const gaqlQuery = `
        SELECT
          customer_client.client_customer,
          customer_client.descriptive_name,
          customer_client.level,
          customer_client.manager,
          customer_client.status,
          customer_client.id
        FROM customer_client
        WHERE customer_client.level <= 1
      `.trim();

      const searchUrl = `https://googleads.googleapis.com/${API_VERSION}/customers/${loginCustomerId}/googleAds:searchStream`;
      const searchRes = await fetch(searchUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
          "login-customer-id": loginCustomerId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: gaqlQuery }),
      });

      const searchContentType = searchRes.headers.get("content-type") || "";
      if (!searchRes.ok || !searchContentType.includes("application/json")) {
        const text = await searchRes.text();
        result.customerClient = {
          status: searchRes.status,
          error: text.substring(0, 500),
          content_type: searchContentType,
          url_used: searchUrl,
        };
      } else {
        const searchData = await searchRes.json();

        if (searchData.error) {
          result.customerClient = {
            status: "api_error",
            error: searchData.error,
          };
        } else {
          const allResults: any[] = [];
          if (Array.isArray(searchData)) {
            for (const batch of searchData) {
              if (batch.results) allResults.push(...batch.results);
            }
          } else if (searchData.results) {
            allResults.push(...searchData.results);
          }

          const clients = allResults.map((r: any) => {
            const cc = r.customerClient;
            return {
              id: cc?.id ? String(cc.id) : (cc?.clientCustomer || "").replace("customers/", ""),
              descriptive_name: cc?.descriptiveName || "",
              level: cc?.level,
              manager: cc?.manager,
              status: cc?.status,
            };
          });

          result.customerClient = {
            status: searchRes.status,
            count: clients.length,
            clients: clients.slice(0, 20),
          };

          // ── Persist accounts if requested ──
          if (persist) {
            let upsertedCount = 0;
            for (const client of clients) {
              const isManager = client.manager === true;
              const statusStr = client.status === "ENABLED" ? "active" : "disabled";
              const accountData = {
                workspace_id: wsId,
                provider: "google_ads" as const,
                external_account_id: String(client.id),
                name: client.descriptive_name || `Customer ${client.id}`,
                status: (statusStr === "active" ? "active" : "disabled") as "active" | "disabled",
                integration_id: integration.id,
                metadata: {
                  manager: isManager,
                  manager_customer_id: loginCustomerId,
                  enabled: !isManager,
                  sync_status: "ok",
                  level: client.level,
                },
              };

              const { data: existing } = await supabase
                .from("accounts").select("id")
                .eq("workspace_id", wsId)
                .eq("external_account_id", String(client.id))
                .eq("provider", "google_ads")
                .maybeSingle();

              if (existing) {
                await supabase.from("accounts").update(accountData).eq("id", existing.id);
              } else {
                await supabase.from("accounts").insert(accountData);
              }
              upsertedCount++;
            }
            result.persisted = { upserted: upsertedCount };
          }
        }
      }
    } else {
      result.customerClient = { error: "No login_customer_id configured" };
    }

    // ── Step 3: Also try search (non-stream) as fallback diagnostic ──
    if (loginCustomerId) {
      const searchUrl2 = `https://googleads.googleapis.com/${API_VERSION}/customers/${loginCustomerId}/googleAds:search`;
      const searchRes2 = await fetch(searchUrl2, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
          "login-customer-id": loginCustomerId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: "SELECT customer_client.id, customer_client.descriptive_name, customer_client.level, customer_client.manager FROM customer_client WHERE customer_client.level <= 1",
          pageSize: 20,
        }),
      });

      const ct2 = searchRes2.headers.get("content-type") || "";
      if (!searchRes2.ok || !ct2.includes("application/json")) {
        const text = await searchRes2.text();
        result.customerClient_search = {
          status: searchRes2.status,
          error: text.substring(0, 500),
          content_type: ct2,
        };
      } else {
        const data2 = await searchRes2.json();
        if (data2.error) {
          result.customerClient_search = { status: "api_error", error: data2.error };
        } else {
          const results2 = data2.results || [];
          result.customerClient_search = {
            status: searchRes2.status,
            count: results2.length,
            clients: results2.slice(0, 20).map((r: any) => ({
              id: r.customerClient?.id ? String(r.customerClient.id) : "",
              name: r.customerClient?.descriptiveName || "",
              level: r.customerClient?.level,
              manager: r.customerClient?.manager,
            })),
          };
        }
      }
    }

    return json({ success: true, ...result });
  } catch (error) {
    console.error("debug-google-ads-discovery error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
