import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const META_APP_ID = Deno.env.get('META_APP_ID');
    if (!META_APP_ID) throw new Error('META_APP_ID not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    if (!SUPABASE_URL) throw new Error('SUPABASE_URL not configured');

    const { workspace_id, force_reauth } = await req.json();
    if (!workspace_id) throw new Error('workspace_id is required');

    const redirectUri = `${SUPABASE_URL}/functions/v1/oauth-callback-meta`;
    const nonce = crypto.randomUUID();
    const state = btoa(JSON.stringify({ workspace_id, nonce }));
    const scopes = 'ads_read,business_management';

    const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    authUrl.searchParams.set('client_id', META_APP_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');
    
    // Force reauth to re-request permissions (multi-BM support)
    if (force_reauth) {
      authUrl.searchParams.set('auth_type', 'rerequest');
    }

    return new Response(JSON.stringify({ url: authUrl.toString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
