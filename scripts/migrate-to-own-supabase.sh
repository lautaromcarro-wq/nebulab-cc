#!/usr/bin/env bash
# ============================================================================
# Migración: Lovable Cloud → Supabase propio
# ----------------------------------------------------------------------------
# Pre-requisitos:
#   - Supabase CLI instalado (brew install supabase/tap/supabase)
#   - Repo clonado y currrent dir = raíz del repo
#   - Proyecto Supabase nuevo creado en tu cuenta personal
#   - Variables de entorno o config seteadas (ver abajo)
#
# Uso:
#   chmod +x scripts/migrate-to-own-supabase.sh
#   NEW_PROJECT_REF=xxx SUPABASE_DB_PASSWORD=yyy ./scripts/migrate-to-own-supabase.sh
#
# Diferencias con la versión inicial del script:
#   - Auto-descubre edge functions desde supabase/functions/* (no hardcoded)
#   - Regenera src/integrations/supabase/types.ts después del db push
#   - Usa SUPABASE_DB_PASSWORD env var (no --password en CLI, no queda en ps aux)
#   - Aborta si link falla (no deploya al proyecto viejo por accidente)
# ============================================================================

set -euo pipefail

# ==== CONFIG ================================================================
NEW_PROJECT_REF="${NEW_PROJECT_REF:-}"
SUPABASE_DB_PASSWORD="${SUPABASE_DB_PASSWORD:-}"
REPO_DIR="${REPO_DIR:-$(pwd)}"

# Secrets a setear. Pegá los valores en SECRETS_VALUES o exportalos como env vars.
# Si exportás como env var (ej: export META_APP_ID=...), el script los toma de ahí.
SECRET_KEYS=(
  META_APP_ID
  META_APP_SECRET
  GOOGLE_ADS_CLIENT_ID
  GOOGLE_ADS_CLIENT_SECRET
  GOOGLE_ADS_DEVELOPER_TOKEN
  GOOGLE_ADS_LOGIN_CUSTOMER_ID
  ANTHROPIC_API_KEY
)

# ==== VALIDATIONS ===========================================================

if [[ -z "$NEW_PROJECT_REF" ]]; then
  echo "✗ NEW_PROJECT_REF no seteado. Export it or edit the script." >&2
  exit 1
fi

if [[ -z "$SUPABASE_DB_PASSWORD" ]]; then
  echo "✗ SUPABASE_DB_PASSWORD no seteado. Export it." >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "✗ Supabase CLI no encontrado. brew install supabase/tap/supabase" >&2
  exit 1
fi

cd "$REPO_DIR"

if [[ ! -d "supabase/functions" ]]; then
  echo "✗ No estás en la raíz del repo (no encuentro supabase/functions/)." >&2
  exit 1
fi

# Export so child supabase commands pick it up without --password flag.
export SUPABASE_DB_PASSWORD

# ==== 1. LINK ===============================================================
echo "▶ 1. Linkeando repo al nuevo proyecto Supabase ($NEW_PROJECT_REF)…"
supabase link --project-ref "$NEW_PROJECT_REF"

# Sanity check: confirmar que el link quedó bien.
if ! supabase status 2>&1 | grep -q "$NEW_PROJECT_REF"; then
  echo "  (Link silencioso — continuando, supabase db push va a confirmar)"
fi

# ==== 2. APPLY MIGRATIONS ===================================================
echo "▶ 2. Aplicando migrations contra el proyecto nuevo…"
supabase db push

# ==== 3. REGENERATE TYPES ===================================================
echo "▶ 3. Regenerando src/integrations/supabase/types.ts…"
supabase gen types typescript --linked > src/integrations/supabase/types.ts
echo "  ✓ types.ts actualizado. Acordate de commitearlo después."

# ==== 4. SET SECRETS ========================================================
echo "▶ 4. Seteando secrets en el proyecto nuevo…"
for name in "${SECRET_KEYS[@]}"; do
  val="${!name:-}"
  if [[ -z "$val" ]]; then
    echo "   ⚠ $name vacío — saltando. Cargalo manualmente en Dashboard o exportalo y volvé a correr."
    continue
  fi
  # supabase secrets set acepta KEY=VALUE
  supabase secrets set "$name=$val" --project-ref "$NEW_PROJECT_REF" >/dev/null
  echo "   ✓ $name"
done

# ==== 5. DEPLOY EDGE FUNCTIONS ==============================================
echo "▶ 5. Deployando edge functions (auto-descubiertas en supabase/functions/)…"
deploy_failures=()

for fn_dir in supabase/functions/*/; do
  fn=$(basename "$fn_dir")
  # Skip _shared (no es una function deployable, son helpers compartidos)
  if [[ "$fn" == "_shared" ]]; then
    continue
  fi
  echo "   → $fn"
  if supabase functions deploy "$fn" --project-ref "$NEW_PROJECT_REF" >/dev/null 2>&1; then
    echo "     ✓"
  else
    echo "     ✗ Falló. Revisá imports / deno.lock"
    deploy_failures+=("$fn")
  fi
done

if [[ ${#deploy_failures[@]} -gt 0 ]]; then
  echo ""
  echo "⚠ Funciones que fallaron al deployar (${#deploy_failures[@]}):"
  printf '   - %s\n' "${deploy_failures[@]}"
  echo "   Probá deployarlas manualmente con: supabase functions deploy <nombre>"
fi

# ==== 6. POST-MIGRATION REMINDERS ===========================================
cat <<EOF

═══════════════════════════════════════════════════════════════════════════════
✅ Migración técnica completa. Falta lo manual:
═══════════════════════════════════════════════════════════════════════════════

a) DATA RESTORE
   - Si pediste pg_dump a Lovable y te lo dieron:
     psql "postgres://postgres:\$SUPABASE_DB_PASSWORD@db.$NEW_PROJECT_REF.supabase.co:5432/postgres" < dump.sql
   - Si no te lo dan, exportá tabla por tabla CSV desde Lovable y \\copy al nuevo.

b) OAUTH REDIRECT URIs (registralos en Meta + Google Cloud Console):
   Meta:    https://$NEW_PROJECT_REF.supabase.co/functions/v1/oauth-callback-meta
   Google:  https://$NEW_PROJECT_REF.supabase.co/functions/v1/oauth-callback-google-ads
   GA4:     https://$NEW_PROJECT_REF.supabase.co/functions/v1/oauth-callback-ga4

c) FRONTEND ENV VARS (Vercel → Settings → Environment Variables):
   VITE_SUPABASE_URL=https://$NEW_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<anon key del proyecto nuevo>
   VITE_SUPABASE_PROJECT_ID=$NEW_PROJECT_REF
   → después: redeploy en Vercel.

d) RECONNECT OAUTH desde la UI (los tokens viejos no sirven en el proyecto nuevo).

e) CRON JOBS (Database → Cron en el Dashboard):
   Replicá los schedules del proyecto viejo si tenías job-orchestrator
   corriendo periódicamente.

f) COMMITEAR src/integrations/supabase/types.ts al repo.

═══════════════════════════════════════════════════════════════════════════════
EOF
