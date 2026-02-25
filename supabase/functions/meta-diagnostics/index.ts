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

    const { workspace_id } = await req.json();
    if (!workspace_id) throw new Error("workspace_id required");

    // Get integration + credential
    const { data: integration } = await supabase
      .from("integrations")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("provider", "meta")
      .eq("status", "connected")
      .maybeSingle();

    if (!integration) {
      return jsonRes({ success: false, error: "No connected Meta integration" });
    }

    const { data: cred } = await supabase
      .from("credentials")
      .select("access_token, meta_long_lived_token")
      .eq("integration_id", integration.id)
      .maybeSingle();

    const token = cred?.meta_long_lived_token || cred?.access_token;
    if (!token) {
      return jsonRes({ success: false, error: "No token found" });
    }

    // Get accounts
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, external_account_id, name, metadata")
      .eq("workspace_id", workspace_id)
      .eq("provider", "meta");

    if (!accounts?.length) {
      return jsonRes({ success: true, results: [], message: "No accounts found" });
    }

    // Test each account with a lightweight call
    const results = [];
    for (const acct of accounts) {
      const actId = acct.external_account_id.startsWith("act_")
        ? acct.external_account_id
        : `act_${acct.external_account_id}`;

      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${actId}?fields=account_id,name,currency,timezone_name,account_status,business{id,name}&access_token=${token}`
        );
        const data = await res.json();

        if (data.error) {
          const errCode = data.error.code?.toString() || "";
          const errSubcode = data.error.error_subcode?.toString() || "";
          const errMsg = data.error.message || "Unknown";
          const fbtraceId = data.error.fbtrace_id || "";

          const isBlocked = errMsg.toLowerCase().includes("blocked") || errCode === "10" || errCode === "200";
          const isTokenError = errCode === "190" || errCode === "102";
          const status = isTokenError ? "error_token" : isBlocked ? "blocked" : "error";

          results.push({
            account_id: acct.id,
            external_id: actId,
            name: acct.name,
            status,
            error: { code: errCode, subcode: errSubcode, message: errMsg, fbtrace_id: fbtraceId },
            business: null,
          });

          // Update account metadata
          const meta = (acct.metadata as Record<string, unknown>) || {};
          await supabase.from("accounts").update({
            metadata: { ...meta, sync_status: status, sync_error: errMsg, sync_error_code: errCode },
          }).eq("id", acct.id);

          // Log health event
          await supabase.from("health_events").insert({
            workspace_id, provider: "meta", check_type: "meta_account_diagnostic",
            severity: "warn", entity_type: "account", entity_id: acct.id,
            message: `Diagnostic: ${status} - ${errMsg} (code=${errCode})`,
          });
        } else {
          results.push({
            account_id: acct.id,
            external_id: actId,
            name: data.name || acct.name,
            status: "ok",
            error: null,
            business: data.business ? { id: data.business.id, name: data.business.name } : null,
          });

          // Update metadata to ok
          const meta = (acct.metadata as Record<string, unknown>) || {};
          await supabase.from("accounts").update({
            metadata: {
              ...meta,
              sync_status: "ok",
              sync_error: null,
              sync_error_code: null,
              business_id: data.business?.id || meta.business_id,
              business_name: data.business?.name || meta.business_name,
            },
          }).eq("id", acct.id);
        }
      } catch (err) {
        results.push({
          account_id: acct.id,
          external_id: actId,
          name: acct.name,
          status: "error",
          error: { message: err instanceof Error ? err.message : "Network error" },
          business: null,
        });
      }
    }

    return jsonRes({ success: true, results });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function jsonRes(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
