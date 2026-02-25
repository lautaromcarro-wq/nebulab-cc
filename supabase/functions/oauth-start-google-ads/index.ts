const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_ADS_CLIENT_ID");
    if (!GOOGLE_CLIENT_ID) throw new Error("GOOGLE_ADS_CLIENT_ID not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    if (!SUPABASE_URL) throw new Error("SUPABASE_URL not configured");

    // Support both GET (direct navigation) and POST (invoke)
    let workspace_id: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      workspace_id = url.searchParams.get("workspace_id");
    } else {
      try {
        const body = await req.json();
        workspace_id = body.workspace_id;
      } catch {
        throw new Error("Invalid request body");
      }
    }

    if (!workspace_id) throw new Error("workspace_id is required");

    const redirectUri = `${SUPABASE_URL}/functions/v1/oauth-callback-google-ads`;
    const nonce = crypto.randomUUID();
    const state = btoa(JSON.stringify({ workspace_id, nonce }));

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/adwords");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    // Debug log (no secrets)
    console.log("[oauth-start-google-ads] Redirect params:", JSON.stringify({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: "https://www.googleapis.com/auth/adwords",
      access_type: "offline",
      prompt: "consent",
      workspace_id,
      full_url: authUrl.toString(),
    }));

    // For GET requests: return 302 redirect (top-level navigation, no iframe issues)
    if (req.method === "GET") {
      return new Response(null, {
        status: 302,
        headers: {
          "Location": authUrl.toString(),
          ...corsHeaders,
        },
      });
    }

    // For POST requests: return URL as JSON (backwards compat)
    return new Response(JSON.stringify({ url: authUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // For GET errors, redirect to app with error
    if (req.method === "GET") {
      const appUrl = Deno.env.get("APP_URL") || "https://nebulab-command-center.lovable.app";
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${appUrl}/connections?oauth=google_ads&status=error&message=${encodeURIComponent(message)}`,
        },
      });
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
