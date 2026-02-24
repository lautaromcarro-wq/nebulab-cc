import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const errorParam = url.searchParams.get('error');

    if (errorParam) {
      return redirectWithError(`Meta denied access: ${errorParam}`);
    }
    if (!code || !stateParam) {
      return redirectWithError('Missing code or state parameter');
    }

    let workspace_id: string;
    try {
      const parsed = JSON.parse(atob(stateParam));
      workspace_id = parsed.workspace_id;
    } catch {
      return redirectWithError('Invalid state parameter');
    }

    const META_APP_ID = Deno.env.get('META_APP_ID')!;
    const META_APP_SECRET = Deno.env.get('META_APP_SECRET')!;
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const redirectUri = `${SUPABASE_URL}/functions/v1/oauth-callback-meta`;

    // 1. Exchange code for short-lived token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&client_secret=${META_APP_SECRET}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return redirectWithError(`Token exchange failed: ${tokenData.error.message}`);
    }

    const shortToken = tokenData.access_token;

    // 2. Exchange for long-lived token
    const llRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&client_id=${META_APP_ID}` +
      `&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortToken}`
    );
    const llData = await llRes.json();

    if (llData.error) {
      return redirectWithError(`Long-lived token exchange failed: ${llData.error.message}`);
    }

    const longLivedToken = llData.access_token;
    const expiresIn = llData.expires_in || 5184000; // ~60 days default
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 3. Use service role client for DB operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 4. Upsert integration
    const { data: integration, error: intErr } = await supabase
      .from('integrations')
      .upsert({
        workspace_id,
        provider: 'meta',
        status: 'connected',
        scopes: ['ads_read', 'read_insights', 'business_management'],
        token_expires_at: expiresAt,
        token_health: { last_check: new Date().toISOString(), status: 'ok' },
      }, { onConflict: 'workspace_id,provider' })
      .select('id')
      .single();

    if (intErr) {
      // Try insert if upsert fails (no unique constraint on workspace_id,provider)
      const { data: existing } = await supabase
        .from('integrations')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('provider', 'meta')
        .maybeSingle();

      let integrationId: string;

      if (existing) {
        await supabase
          .from('integrations')
          .update({
            status: 'connected',
            scopes: ['ads_read', 'read_insights', 'business_management'],
            token_expires_at: expiresAt,
            token_health: { last_check: new Date().toISOString(), status: 'ok' },
          })
          .eq('id', existing.id);
        integrationId = existing.id;
      } else {
        const { data: newInt, error: newErr } = await supabase
          .from('integrations')
          .insert({
            workspace_id,
            provider: 'meta',
            status: 'connected',
            scopes: ['ads_read', 'read_insights', 'business_management'],
            token_expires_at: expiresAt,
            token_health: { last_check: new Date().toISOString(), status: 'ok' },
          })
          .select('id')
          .single();
        if (newErr) return redirectWithError(`DB error: ${newErr.message}`);
        integrationId = newInt!.id;
      }

      // Save credential
      await saveCredential(supabase, workspace_id, integrationId, longLivedToken, expiresAt);
      // Discover ad accounts
      await discoverAdAccounts(supabase, longLivedToken, workspace_id, integrationId);
      // Log sync run
      await logSyncRun(supabase, workspace_id, 'success');

      return redirectToApp('success');
    }

    // Save credential
    await saveCredential(supabase, workspace_id, integration!.id, longLivedToken, expiresAt);

    // 5. Discover ad accounts
    await discoverAdAccounts(supabase, longLivedToken, workspace_id, integration!.id);

    // 6. Log sync run
    await logSyncRun(supabase, workspace_id, 'success');

    return redirectToApp('success');
  } catch (error) {
    console.error('OAuth callback error:', error instanceof Error ? error.message : error);
    return redirectWithError('Internal server error');
  }
});

async function saveCredential(
  supabase: any,
  workspaceId: string,
  integrationId: string,
  accessToken: string,
  expiresAt: string
) {
  // Check existing
  const { data: existing } = await supabase
    .from('credentials')
    .select('id')
    .eq('integration_id', integrationId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('credentials')
      .update({
        access_token: accessToken,
        meta_long_lived_token: accessToken,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('credentials')
      .insert({
        workspace_id: workspaceId,
        integration_id: integrationId,
        access_token: accessToken,
        meta_long_lived_token: accessToken,
        expires_at: expiresAt,
      });
  }
}

async function discoverAdAccounts(
  supabase: any,
  accessToken: string,
  workspaceId: string,
  integrationId: string
) {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=account_id,name,currency,timezone_name,account_status&limit=100&access_token=${accessToken}`
    );
    const data = await res.json();

    if (!data.data || !Array.isArray(data.data)) return;

    for (const acct of data.data) {
      const { data: existing } = await supabase
        .from('accounts')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('external_account_id', acct.account_id)
        .eq('provider', 'meta')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('accounts')
          .update({
            name: acct.name || '',
            currency: acct.currency || null,
            timezone: acct.timezone_name || null,
            status: acct.account_status === 1 ? 'active' : 'disabled',
            integration_id: integrationId,
            metadata: { raw_status: acct.account_status },
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('accounts')
          .insert({
            workspace_id: workspaceId,
            provider: 'meta',
            external_account_id: acct.account_id,
            name: acct.name || '',
            currency: acct.currency || null,
            timezone: acct.timezone_name || null,
            status: acct.account_status === 1 ? 'active' : 'disabled',
            integration_id: integrationId,
            metadata: { raw_status: acct.account_status },
          });
      }
    }
  } catch (err) {
    console.error('Ad account discovery error:', err instanceof Error ? err.message : err);
  }
}

async function logSyncRun(
  supabase: any,
  workspaceId: string,
  status: 'success' | 'error',
  errorMessage?: string
) {
  await supabase.from('sync_runs').insert({
    workspace_id: workspaceId,
    provider: 'meta',
    job_name: 'oauth_meta_connect',
    status,
    error_message: errorMessage || null,
    ended_at: new Date().toISOString(),
  });
}

function redirectToApp(status: string): Response {
  // Return an HTML page that posts a message to the opener and closes the popup
  const html = `<!DOCTYPE html><html><body><script>
    if (window.opener) {
      window.opener.postMessage({ type: 'oauth-complete', provider: 'meta', status: '${status}' }, '*');
      window.close();
    } else {
      var appUrl = '${Deno.env.get('APP_URL') || 'https://nebulab-command-center.lovable.app'}';
      window.location.href = appUrl + '/connections?oauth=meta&status=${status}';
    }
  </script></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}

function redirectWithError(message: string): Response {
  logSyncRunDirect(message);
  const encodedMsg = encodeURIComponent(message);
  const html = `<!DOCTYPE html><html><body><script>
    if (window.opener) {
      window.opener.postMessage({ type: 'oauth-complete', provider: 'meta', status: 'error', message: decodeURIComponent('${encodedMsg}') }, '*');
      window.close();
    } else {
      var appUrl = '${Deno.env.get('APP_URL') || 'https://nebulab-command-center.lovable.app'}';
      window.location.href = appUrl + '/connections?oauth=meta&status=error&message=${encodedMsg}';
    }
  </script></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}

function logSyncRunDirect(errorMessage: string) {
  // Best-effort logging - won't block redirect
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    supabase.from('sync_runs').insert({
      workspace_id: '00000000-0000-0000-0000-000000000000',
      provider: 'meta',
      job_name: 'oauth_meta_connect',
      status: 'error',
      error_message: errorMessage,
      ended_at: new Date().toISOString(),
    });
  } catch { /* ignore */ }
}
