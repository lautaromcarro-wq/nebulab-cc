const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Stub: GA4 OAuth callback
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: "GA4 OAuth callback not yet implemented.",
    }),
    { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});