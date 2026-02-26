import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // GA4 reuses the same Google OAuth credentials as Google Ads
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_ADS_CLIENT_ID");

    if (!GOOGLE_CLIENT_ID) {
      const errorMsg = "Missing GOOGLE_ADS_CLIENT_ID (shared with GA4)";
      console.error("[oauth-start-ga4]", errorMsg);
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await sb.from("health_events").insert({
          workspace_id: "00000000-0000-0000-0000-000000000000",
          check_type: "ga4_oauth_error", severity: "critical",
          message: errorMsg, provider: "ga4",
        });
      }
      if (req.method === "GET") {
        const appUrl = Deno.env.get("APP_URL") || "https://nebulab-command-center.lovable.app";
        return new Response(null, {
          status: 302,
          headers: { "Location": `${appUrl}/connections?oauth=ga4&status=error&message=${encodeURIComponent(errorMsg)}&correlation_id=${correlationId}` },
        });
      }
      return new Response(JSON.stringify({ error: errorMsg, correlation_id: correlationId }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!SUPABASE_URL) throw new Error("SUPABASE_URL not configured");

    // Parse workspace_id
    let workspace_id: string | null = null;
    if (req.method === "GET") {
      workspace_id = new URL(req.url).searchParams.get("workspace_id");
    } else {
      try { const body = await req.json(); workspace_id = body.workspace_id; } catch { throw new Error("Invalid request body"); }
    }
    if (!workspace_id) throw new Error("workspace_id is required");

    const redirectUri = `${SUPABASE_URL}/functions/v1/oauth-callback-ga4`;
    const nonce = crypto.randomUUID();
    const state = btoa(JSON.stringify({ workspace_id, nonce, correlation_id: correlationId }));

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/analytics.readonly");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    console.log("[oauth-start-ga4]", JSON.stringify({
      correlation_id: correlationId, workspace_id, redirect_uri: redirectUri,
      client_id_prefix: GOOGLE_CLIENT_ID.substring(0, 8),
      scopes: "analytics.readonly",
    }));

    if (req.method === "GET") {
      return new Response(null, {
        status: 302,
        headers: { "Location": authUrl.toString(), ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ url: authUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[oauth-start-ga4] Exception:", JSON.stringify({ correlation_id: correlationId, message }));

    if (req.method === "GET") {
      const appUrl = Deno.env.get("APP_URL") || "https://nebulab-command-center.lovable.app";
      return new Response(null, {
        status: 302,
        headers: { "Location": `${appUrl}/connections?oauth=ga4&status=error&message=${encodeURIComponent(message)}&correlation_id=${correlationId}` },
      });
    }

    return new Response(JSON.stringify({ error: message, correlation_id: correlationId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
