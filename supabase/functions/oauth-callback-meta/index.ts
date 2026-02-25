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

    // 2. Exchange for long-lived token
    const llRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&client_id=${META_APP_ID}` +
      `&client_secret=${META_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    );
    const llData = await llRes.json();
    if (llData.error) {
      return redirectWithError(`Long-lived token exchange failed: ${llData.error.message}`);
    }

    const longLivedToken = llData.access_token;
    const expiresIn = llData.expires_in || 5184000;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 3. Upsert integration
    const integrationId = await upsertIntegration(supabase, workspace_id, expiresAt);

    // 4. Save credential
    await saveCredential(supabase, workspace_id, integrationId, longLivedToken, expiresAt);

    // 5. Discover ad accounts with business info + populate allowlist
    await discoverAdAccounts(supabase, longLivedToken, workspace_id, integrationId);

    // 6. Auto-populate meta_allowed_businesses for newly discovered BMs
    await autoPopulateAllowlist(supabase, workspace_id);

    // 7. Log sync run
    await logSyncRun(supabase, workspace_id, 'success');

    return redirectToApp('success');
  } catch (error) {
    console.error('OAuth callback error:', error instanceof Error ? error.message : error);
    return redirectWithError('Internal server error');
  }
});

async function upsertIntegration(supabase: any, workspaceId: string, expiresAt: string): Promise<string> {
  const payload = {
    workspace_id: workspaceId,
    provider: 'meta',
    status: 'connected',
    scopes: ['ads_read', 'business_management'],
    token_expires_at: expiresAt,
    token_health: { last_check: new Date().toISOString(), status: 'ok' },
  };

  // Try find existing
  const { data: existing } = await supabase
    .from('integrations')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'meta')
    .maybeSingle();

  if (existing) {
    await supabase.from('integrations').update(payload).eq('id', existing.id);
    return existing.id;
  }

  const { data: newInt, error } = await supabase
    .from('integrations').insert(payload).select('id').single();
  if (error) throw new Error(`DB error: ${error.message}`);
  return newInt!.id;
}

async function saveCredential(supabase: any, workspaceId: string, integrationId: string, accessToken: string, expiresAt: string) {
  const { data: existing } = await supabase
    .from('credentials').select('id').eq('integration_id', integrationId).maybeSingle();

  const now = new Date().toISOString();
  if (existing) {
    await supabase.from('credentials').update({
      access_token: accessToken, meta_long_lived_token: accessToken,
      expires_at: expiresAt, updated_at: now,
    }).eq('id', existing.id);
  } else {
    await supabase.from('credentials').insert({
      workspace_id: workspaceId, integration_id: integrationId,
      access_token: accessToken, meta_long_lived_token: accessToken, expires_at: expiresAt,
    });
  }
}

async function discoverAdAccounts(supabase: any, accessToken: string, workspaceId: string, integrationId: string) {
  try {
    // Request business info fields alongside standard account fields
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=account_id,name,currency,timezone_name,account_status,business{id,name}&limit=100&access_token=${accessToken}`
    );
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) return;

    for (const acct of data.data) {
      const businessId = acct.business?.id || null;
      const businessName = acct.business?.name || null;

      const accountData = {
        workspace_id: workspaceId,
        provider: 'meta' as const,
        external_account_id: acct.account_id,
        name: acct.name || '',
        currency: acct.currency || null,
        timezone: acct.timezone_name || null,
        status: (acct.account_status === 1 ? 'active' : 'disabled') as 'active' | 'disabled',
        integration_id: integrationId,
        metadata: {
          raw_status: acct.account_status,
          business_id: businessId,
          business_name: businessName,
        },
      };

      const { data: existing } = await supabase
        .from('accounts').select('id')
        .eq('workspace_id', workspaceId)
        .eq('external_account_id', acct.account_id)
        .eq('provider', 'meta')
        .maybeSingle();

      if (existing) {
        await supabase.from('accounts').update(accountData).eq('id', existing.id);
      } else {
        await supabase.from('accounts').insert(accountData);
      }
    }
  } catch (err) {
    console.error('Ad account discovery error:', err instanceof Error ? err.message : err);
}

async function autoPopulateAllowlist(supabase: any, workspaceId: string) {
  try {
    // Get all discovered accounts with business_id
    const { data: accounts } = await supabase
      .from('accounts').select('id, name, metadata')
      .eq('workspace_id', workspaceId).eq('provider', 'meta');

    if (!accounts?.length) return;

    // Collect unique businesses
    const businesses = new Map<string, string>();
    for (const acct of accounts) {
      const meta = acct.metadata as Record<string, any> | null;
      const bizId = meta?.business_id;
      const bizName = meta?.business_name || '';
      if (bizId && !businesses.has(bizId)) {
        businesses.set(bizId, bizName);
      }
    }

    // Upsert each business (default enabled=false for safe discovery)
    for (const [bizId, bizName] of businesses) {
      const { data: existing } = await supabase
        .from('meta_allowed_businesses').select('id')
        .eq('workspace_id', workspaceId).eq('business_id', bizId).maybeSingle();

      if (!existing) {
        await supabase.from('meta_allowed_businesses').insert({
          workspace_id: workspaceId, business_id: bizId, business_name: bizName, enabled: false,
        });
      } else {
        // Update name if changed
        await supabase.from('meta_allowed_businesses').update({ business_name: bizName }).eq('id', existing.id);
      }
    }

    // Also create meta_sync_prefs if not exists
    const { data: prefs } = await supabase
      .from('meta_sync_prefs').select('id').eq('workspace_id', workspaceId).maybeSingle();
    if (!prefs) {
      await supabase.from('meta_sync_prefs').insert({ workspace_id: workspaceId, mode: 'allowlist' });
    }
  } catch (err) {
    console.error('Auto-populate allowlist error:', err instanceof Error ? err.message : err);
  }
}
}

async function logSyncRun(supabase: any, workspaceId: string, status: 'success' | 'error', errorMessage?: string) {
  await supabase.from('sync_runs').insert({
    workspace_id: workspaceId, provider: 'meta', job_name: 'oauth_meta_connect',
    status, error_message: errorMessage || null, ended_at: new Date().toISOString(),
  });
}

function redirectToApp(status: string): Response {
  const html = `<!DOCTYPE html><html><body><script>
    if (window.opener) {
      window.opener.postMessage({ type: 'oauth-complete', provider: 'meta', status: '${status}' }, '*');
      window.close();
    } else {
      var appUrl = '${Deno.env.get('APP_URL') || 'https://nebulab-command-center.lovable.app'}';
      window.location.href = appUrl + '/connections?oauth=meta&status=${status}';
    }
  </script></body></html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
}

function redirectWithError(message: string): Response {
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
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
}
