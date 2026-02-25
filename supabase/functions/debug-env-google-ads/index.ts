import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function mask(val: string | undefined | null): string {
  if (!val) return "(not set)";
  if (val.length <= 12) return val.substring(0, 3) + "***" + val.substring(val.length - 3);
  return val.substring(0, 6) + "***" + val.substring(val.length - 6);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check - admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = claims.claims.sub as string;
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET");
    const devToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");
    const loginCustomerId = Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID");
    const redirectUri = `${SUPABASE_URL}/functions/v1/oauth-callback-google-ads`;

    const result = {
      GOOGLE_ADS_CLIENT_ID: mask(clientId),
      GOOGLE_ADS_LOGIN_CUSTOMER_ID: mask(loginCustomerId),
      GOOGLE_ADS_DEVELOPER_TOKEN_EXISTS: !!devToken,
      GOOGLE_ADS_CLIENT_SECRET_EXISTS: !!clientSecret,
      REDIRECT_URI: redirectUri,
      SUPABASE_URL: SUPABASE_URL || "(not set)",
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
