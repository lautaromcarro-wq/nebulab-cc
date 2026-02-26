import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const API_VERSION = "v22";

interface ClientNode {
  id: string;
  descriptive_name: string;
  level: number;
  manager: boolean;
  status: string;
  hidden: boolean;
  parent_customer_id: string;
}

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

    // Find integration + credential
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
      const newExpiry = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();
      await supabase.from("credentials").update({
        access_token: accessToken,
        expires_at: newExpiry,
        updated_at: new Date().toISOString(),
      }).eq("integration_id", integration.id);
    }

    const debugLog: Record<string, unknown>[] = [];

    const log = (msg: string, data?: Record<string, unknown>) => {
      const entry = { ts: new Date().toISOString(), msg, ...data };
      debugLog.push(entry);
      console.log("[discovery]", JSON.stringify(entry));
    };

    log("config", {
      login_customer_id: loginCustomerId,
      api_version: API_VERSION,
      workspace_id: wsId,
      integration_id: integration.id,
    });

    if (!loginCustomerId) {
      return json({
        success: false,
        error: "No GOOGLE_ADS_LOGIN_CUSTOMER_ID configured",
        debug_log: debugLog,
      });
    }

    // ── Step 1: ListAccessibleCustomers (to validate token) ──
    const listUrl = `https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`;
    const listRes = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
      },
    });

    let accessibleIds: string[] = [];
    if (!listRes.ok) {
      const text = await listRes.text();
      log("listAccessibleCustomers_error", { status: listRes.status, error: text.substring(0, 500) });
    } else {
      const listData = await listRes.json();
      accessibleIds = (listData.resourceNames || []).map((rn: string) => rn.replace("customers/", ""));
      log("listAccessibleCustomers_ok", {
        count: accessibleIds.length,
        customer_ids: accessibleIds.slice(0, 30),
        login_customer_id_in_list: accessibleIds.includes(loginCustomerId),
      });
    }

    // Check if login_customer_id is accessible
    if (accessibleIds.length > 0 && !accessibleIds.includes(loginCustomerId)) {
      log("WARNING_login_customer_id_mismatch", {
        login_customer_id: loginCustomerId,
        accessible_ids: accessibleIds,
        message: "The configured login_customer_id is NOT in the list of accessible customers for this token",
      });
    }

    // ── Step 2: Recursive traversal ──
    const visited = new Set<string>();
    const allNodes: ClientNode[] = [];

    async function traverseMCC(parentId: string): Promise<void> {
      if (visited.has(parentId)) return;
      visited.add(parentId);

      const gaqlQuery = `
        SELECT
          customer_client.client_customer,
          customer_client.descriptive_name,
          customer_client.level,
          customer_client.manager,
          customer_client.status,
          customer_client.hidden,
          customer_client.id
        FROM customer_client
      `.trim();

      const searchUrl = `https://googleads.googleapis.com/${API_VERSION}/customers/${parentId}/googleAds:searchStream`;

      log("traversal_query", {
        parent_customer_id: parentId,
        query_customer_id: parentId,
        login_customer_id_header: loginCustomerId,
        url: searchUrl,
      });

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

      const ct = searchRes.headers.get("content-type") || "";
      if (!searchRes.ok || !ct.includes("application/json")) {
        const text = await searchRes.text();
        log("traversal_error", {
          parent_customer_id: parentId,
          status: searchRes.status,
          content_type: ct,
          error: text.substring(0, 800),
        });
        return;
      }

      const searchData = await searchRes.json();

      if (searchData.error) {
        log("traversal_api_error", {
          parent_customer_id: parentId,
          error: searchData.error,
        });
        return;
      }

      // Parse results from searchStream (array of batches)
      const allResults: any[] = [];
      if (Array.isArray(searchData)) {
        for (const batch of searchData) {
          if (batch.results) allResults.push(...batch.results);
        }
      } else if (searchData.results) {
        allResults.push(...searchData.results);
      }

      log("traversal_results", {
        parent_customer_id: parentId,
        rows_returned: allResults.length,
        top_20: allResults.slice(0, 20).map((r: any) => {
          const cc = r.customerClient;
          return {
            client_customer: cc?.clientCustomer || "",
            id: cc?.id ? String(cc.id) : "",
            descriptive_name: cc?.descriptiveName || "",
            level: cc?.level,
            manager: cc?.manager,
            status: cc?.status,
            hidden: cc?.hidden,
          };
        }),
      });

      // Collect child manager IDs to traverse next
      const childManagers: string[] = [];

      for (const r of allResults) {
        const cc = r.customerClient;
        const childId = cc?.id ? String(cc.id) : (cc?.clientCustomer || "").replace("customers/", "");
        if (!childId || childId === parentId) continue; // skip self

        const node: ClientNode = {
          id: childId,
          descriptive_name: cc?.descriptiveName || "",
          level: cc?.level ?? 0,
          manager: cc?.manager === true,
          status: cc?.status || "UNKNOWN",
          hidden: cc?.hidden === true,
          parent_customer_id: parentId,
        };

        // Deduplicate
        if (!allNodes.find(n => n.id === node.id)) {
          allNodes.push(node);
        }

        // Queue managers for recursive traversal
        if (node.manager && !visited.has(childId)) {
          childManagers.push(childId);
        }
      }

      // Recurse into child managers
      for (const mgrId of childManagers) {
        await traverseMCC(mgrId);
      }
    }

    await traverseMCC(loginCustomerId);

    log("traversal_complete", {
      total_nodes: allNodes.length,
      managers: allNodes.filter(n => n.manager).length,
      leaf_accounts: allNodes.filter(n => !n.manager).length,
      hidden_count: allNodes.filter(n => n.hidden).length,
      enabled_count: allNodes.filter(n => n.status === "ENABLED").length,
      visited_mccs: Array.from(visited),
    });

    const result: Record<string, unknown> = {
      api_version: API_VERSION,
      login_customer_id: loginCustomerId,
      workspace_id: wsId,
      integration_id: integration.id,
      accessible_customer_ids: accessibleIds,
      traversal: {
        total_nodes: allNodes.length,
        managers: allNodes.filter(n => n.manager).map(n => ({
          id: n.id, name: n.descriptive_name, status: n.status, hidden: n.hidden, parent: n.parent_customer_id,
        })),
        leaf_accounts: allNodes.filter(n => !n.manager).map(n => ({
          id: n.id, name: n.descriptive_name, status: n.status, hidden: n.hidden, parent: n.parent_customer_id,
        })),
        visited_mccs: Array.from(visited),
      },
      debug_log: debugLog,
    };

    // ── Persist if requested ──
    if (persist) {
      let upsertedCount = 0;
      for (const node of allNodes) {
        const statusStr = node.status === "ENABLED" ? "active" : "disabled";
        const accountData = {
          workspace_id: wsId,
          provider: "google_ads" as const,
          external_account_id: String(node.id),
          name: node.descriptive_name || `Customer ${node.id}`,
          status: (statusStr === "active" ? "active" : "disabled") as "active" | "disabled",
          integration_id: integration.id,
          metadata: {
            manager: node.manager,
            manager_customer_id: loginCustomerId,
            parent_customer_id: node.parent_customer_id,
            enabled: !node.manager && node.status === "ENABLED" && !node.hidden,
            sync_status: "ok",
            level: node.level,
            hidden: node.hidden,
            google_status: node.status,
          },
        };

        const { data: existing } = await supabase
          .from("accounts").select("id")
          .eq("workspace_id", wsId)
          .eq("external_account_id", String(node.id))
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
