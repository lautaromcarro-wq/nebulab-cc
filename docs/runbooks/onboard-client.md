# Runbook — Onboard a client into Nebulab Command Center

> Use this to onboard any new client 100% inside the Command Center.
> First client: Angel Baraldo (2026-04-22). Keep this runbook updated as
> the process evolves — it'll become the spec for the self-serve flow.

---

## Prereqs — information to gather BEFORE starting

Do not start the onboarding until you have all of this. Missing info mid-way
is the #1 reason onboardings drag for days.

### Business
- [ ] Client legal/brand name
- [ ] Website URL
- [ ] Status: `active` (default) or `pilot`
- [ ] Business model: `ecom` | `services` | `leads` | `saas` | `marketplace`
- [ ] Vertical(s) — if the client has multiple product lines treated separately

### Financial settings (per client, optionally per vertical)
- [ ] avg_cogs_percent (cost of goods sold, % of revenue)
- [ ] shipping_percent (% of revenue)
- [ ] payment_fee_percent (% of revenue — gateway fees)
- [ ] refund_percent (% of revenue — expected refund rate)
- [ ] iva_percent (VAT/IVA — Argentina = 21 by default)
- [ ] Currency (ARS by default)
- [ ] Timezone (America/Argentina/Buenos_Aires by default)

### Integrations available
- [ ] Meta Ads — ad account ID(s)
- [ ] Google Ads — customer ID(s) + whether they sit under our MCC
- [ ] GA4 — property ID(s)
- [ ] Tiendanube / WooCommerce — store URL + API key if ecom
- [ ] Backfill start date (how far back to pull history — 90 days default)

### Access
- [ ] Who on Nebulab team manages this client
- [ ] Does the client get a public `ClientReport` dashboard? (yes/no)
- [ ] If yes, contact email for the report link

### Segments
- [ ] Does the client need campaign segmentation? (brand / non-brand / retargeting / prospecting)
- [ ] Segment naming convention they use in Meta/Google campaign names

---

## Phase 1 — Create the client record (5 min)

The Command Center UI has a ClientHub page but the first-time creation is
easier to do in SQL for speed. After this, everything else happens in the UI.

### 1.1 Identify the workspace
```sql
SELECT id, name FROM workspaces WHERE name ILIKE '%nebulab%';
```

### 1.2 Create the client
```sql
INSERT INTO clients (workspace_id, name, status, website_url, notes)
VALUES (
  '<workspace_id>',
  '<Client Name>',
  'active',
  '<https://client-website>',
  'Onboarded YYYY-MM-DD. Owner: <team member>. Vertical: <vertical>.'
)
RETURNING id;
```

Save the returned `client_id` — you'll use it everywhere.

### 1.3 Create financial settings
```sql
INSERT INTO client_financial_settings (
  client_id, workspace_id,
  avg_cogs_percent, shipping_percent, payment_fee_percent,
  refund_percent, iva_percent
)
VALUES (
  '<client_id>', '<workspace_id>',
  <cogs>, <shipping>, <payment_fee>, <refund>, <iva>
);
```

### 1.4 (Optional) Create verticals
Only if the client has multiple product lines that need separate P&Ls.
```sql
INSERT INTO client_verticals (client_id, workspace_id, name, business_model)
VALUES ('<client_id>', '<workspace_id>', '<Vertical name>', 'ecom');
```

---

## Phase 2 — Connect integrations (10–30 min per platform)

**Do this in the UI.** Go to `/connections`. OAuth flows cannot be done via SQL.

For each platform:

### 2.1 Meta Ads
1. Navigate to `/connections`.
2. Click "Connect Meta".
3. Login with the account that has access to the client's Business Manager.
4. Select the ad accounts for this client.
5. After connection, run `sync-meta-accounts` to discover ad accounts.
6. Go to Accounts settings and **enable only the accounts for this client**.

### 2.2 Google Ads
1. Click "Connect Google Ads".
2. Login with an account that has access (via MCC or direct).
3. The `debug-google-ads-discovery` function (called from UI button) will
   traverse the MCC and populate `accounts` + `workspace_account_settings`.
4. Enable only the customer IDs for this client.

### 2.3 GA4
1. Click "Connect GA4".
2. Same flow. `debug-ga4-discovery` populates properties.
3. Enable only the properties for this client.

### 2.4 Tiendanube / WooCommerce (if ecom)
1. Navigate to `/ecommerce` (or ClientHub > Ecommerce tab).
2. Click "Conectar tienda".
3. Enter store URL + API key + API secret.
4. After connection, press "Sincronizar" to pull initial orders.

---

## Phase 3 — Enable features for this workspace (SQL, 2 min)

The `workspace_features` table gates experimental/tiered features. For a
full-stack client we turn on what we need:

```sql
INSERT INTO workspace_features (workspace_id, feature_key, enabled, config)
VALUES
  ('<workspace_id>', 'ecommerce.tiendanube',     true, '{}'),
  ('<workspace_id>', 'ai.analyst',               true, '{}'),
  ('<workspace_id>', 'experiments',              true, '{}'),
  ('<workspace_id>', 'reports.weekly_email',     true, '{}'),
  ('<workspace_id>', 'segments.auto_mapping',    true, '{}')
ON CONFLICT (workspace_id, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;
```

Leave `diagnostics.advanced` off unless you're debugging.

---

## Phase 4 — Segmentation (10–20 min, only if needed)

If the client has a naming convention like `brand_search`, `retargeting_fb`,
etc., you can auto-map campaigns to segments.

1. Navigate to `/settings/segments`.
2. For each segment (Brand / Non-Brand / Retargeting / Prospecting), create
   rules matching substrings in campaign names.
3. After saving rules, run `compute-campaign-segment-map` edge function:
   ```bash
   supabase functions invoke compute-campaign-segment-map \
     --body '{"workspace_id":"<workspace_id>","client_id":"<client_id>"}'
   ```
4. Check for unmapped / conflicting campaigns in the UI and fix manually.

---

## Phase 5 — Trigger initial backfill (15 min runtime)

Pulls historical data from Meta/Google/GA4/Tiendanube. Default window: 90 days.

```bash
supabase functions invoke backfill-historical \
  --body '{
    "workspace_id": "<workspace_id>",
    "client_id": "<client_id>",
    "from_date": "YYYY-MM-DD",
    "to_date": "YYYY-MM-DD",
    "providers": ["meta","google_ads","ga4","ecommerce"]
  }'
```

Watch progress in `/admin-ops` (sync_runs table). Expect 5–15 minutes
depending on data volume.

---

## Phase 6 — Validate data is flowing (10 min)

Go to the Command Center UI and verify, in this order:

1. **Home** — KPIs show non-zero spend, revenue, ROAS. Workspace health score ≥ 70.
2. **Performance** — campaigns appear with metrics for the backfill period.
3. **Finance** — revenue + COGS + margin compute correctly.
4. **Ecommerce** (if applicable) — orders, products, customers show up.
5. **Diagnostics** — all connectors show green.
6. **Segments** — if configured, all campaigns are mapped.

If anything is red, don't proceed. Fix first.

---

## Phase 7 — Enable client-facing dashboard (optional, 5 min)

If the client gets a public report link:

1. Navigate to ClientHub > select the client > "Generar token de acceso".
2. Copy the URL (e.g. `https://<domain>/client-report/<token>`).
3. Send it to the client.

The token is stored in `client_access_tokens` and authorizes public read
access to that client's data only (RLS enforced via RPC).

---

## Phase 8 — Schedule recurring syncs (1 min)

The `job-orchestrator` function runs all syncs. Verify it's scheduled in
your Supabase cron (Dashboard > Database > Cron) with a daily trigger.

If not already configured:
```sql
SELECT cron.schedule(
  'nebulab-daily-sync',
  '0 6 * * *',  -- 6am UTC = 3am ART
  $$ SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/job-orchestrator',
    headers := '{"Authorization":"Bearer <service_role>"}'::jsonb
  ) $$
);
```

---

## Post-onboarding checklist

- [ ] Client record created, financial settings saved
- [ ] All 4 integrations connected (or N/A marked explicitly)
- [ ] Accounts enabled for this client only
- [ ] Feature flags set
- [ ] Segmentation rules active (if applicable)
- [ ] Backfill completed without errors
- [ ] All 6 UI pages show valid data
- [ ] Health score ≥ 70
- [ ] Public dashboard token generated (if applicable)
- [ ] Cron job confirmed running
- [ ] Notes added to `clients.notes`: who owns this account, open todos

---

## Common issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Health score < 50 | Missing integration or stale sync | Connections page → reconnect |
| No campaigns after OAuth | Discovery not run | Press "Discover accounts" button in Connections |
| Campaigns appear but `spend = 0` | Account not enabled in workspace_account_settings | Enable in Accounts settings |
| Ecommerce orders missing | Sync not triggered | Press Sincronizar in `/ecommerce` |
| Segmentation empty | Rules not matching or compute not run | Check rules, re-run compute-campaign-segment-map |
| Revenue looks off | Revenue source precedence wrong | Check `source_breakdown` JSON in `workspace_revenue_daily` |

---

## After every onboarding

Spend 5 min updating this runbook with anything that surprised you or took
longer than expected. The third client should take half the time of the
first. If it doesn't, this runbook is failing.
