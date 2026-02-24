const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Stub: Google Ads OAuth start
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: "Google Ads OAuth not yet implemented. Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first.",
    }),
    { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});