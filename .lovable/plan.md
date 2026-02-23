

# 🚀 NEBULAB — Blueprint Ejecutable para Lovable

## 0) PRINCIPIOS DE DISEÑO

- **"De datos a decisiones"**: cada pantalla debe terminar en una acción, no en un número. Si no hay acción, sobra.
- **Multi-tenant estricto**: workspace_id en toda tabla con RLS en Supabase. Cero filtro client-side como barrera.
- **Atribución transparente**: ROAS plataforma ≠ ROAS GA4 ≠ ROAS blended. Siempre visible cuál se muestra.
- **Normalización primero**: un solo diccionario de métricas (metric_definitions) con nombre, unidad, fórmula y fuente.
- **Credenciales aisladas**: tokens OAuth por integración por workspace, nunca compartidos, refresh automático.
- **Incremental by default**: sync solo delta (date_range desde last_sync), nunca full pull salvo manual.
- **Composable con Growth Simulator / Unit Economics**: inputs/outputs vía tablas compartidas o API interna.
- **Ship V1 en 2-3 semanas**: solo lo que da control operativo diario. Sin alertas, sin ML, sin features "nice to have".

---

## 1) FASES DE CONSTRUCCIÓN

### Fase 1 — V1 MVP Interno (Semanas 1-3)
- Auth con Supabase (email/password) + roles (admin, analyst, viewer)
- Workspace selector multi-cliente
- Conexión OAuth a Meta Ads, Google Ads, GA4 (almacenamiento seguro de tokens)
- Sync cada 60 min vía edge functions + cron: campañas, adsets, ads, métricas diarias
- Dashboard Performance Overview: spend, conversions, CAC, ROAS (por plataforma, separado)
- Creative Performance: tabla rankeada con thumbnail, métricas, tags manuales
- Bitácora de cambios: registro manual con template (qué cambió, dónde, por qué)
- Finance básico: input manual de revenue + cálculo de margen de contribución
- Health checks básicos: spend = 0, CVR anómalo, GA4 events = 0 → badge en UI

### Fase 2 — V1.5 (Semanas 4-6)
- Pacing: burn rate, proyección EOM, desvío vs objetivo mensual
- Experiments Board: hipótesis → test → resultado → decisión
- Creative identity: matching cross-plataforma por URL/hash de asset
- Finance avanzado: COGS, shipping, fees, taxes, payback period, LTV/CAC ratio
- Integración con Growth Simulator / Unit Economics como data source
- Anomaly detection con reglas simples (caída >30% día a día, spike de CPA, etc.)
- Reportes internos: resumen semanal auto-generado con insights accionables
- Admin: naming conventions, data mapping, definiciones de KPIs editables

### Fase 3 — V2 (Semanas 7-10)
- Alertas a Slack: reglas configurables (threshold + canal + frecuencia)
- Automatizaciones: pause campaigns si CPA > X (vía API, con confirmación)
- Blended ROAS estimado con disclaimer visible
- Audit log completo (quién hizo qué, cuándo)
- Dashboard comparativo entre clientes (solo admin)
- Export PDF/CSV de dashboards
- API interna para que Growth Simulator / Unit Economics lean en tiempo real

---

## 2) ARQUITECTURA EN LOVABLE

### Componentes
- **UI**: React + shadcn/ui + Recharts (ya instalado). Rutas: login, workspace selector, dashboard, creative, finance, changelog, experiments, admin, connections.
- **DB**: Supabase PostgreSQL con RLS por workspace_id en toda tabla.
- **Auth**: Supabase Auth (email/password). Roles en tabla separada `user_roles`. Permisos chequeados con función `has_role()` security definer.
- **Edge Functions**: sync con Meta/Google/GA4, health checks, future Slack alerts.
- **Cron**: pg_cron + pg_net invocando edge functions cada 60 min.
- **Storage**: Supabase Storage para creative thumbnails/assets cacheados.
- **Secrets**: tokens OAuth y API keys en Supabase secrets, accedidos solo desde edge functions.

### Estrategia de Sync
- **Incremental**: cada job trae datos desde `last_sync_at` del workspace+integration.
- **Cache**: `performance_daily` es la tabla agregada; nunca se consulta la API en tiempo real desde el frontend.
- **Rate limits**: Meta = 200 calls/hour/app; Google = 15K/day. Backoff exponencial con retry x3.
- **Dedup**: upsert por `(platform, entity_id, date)` unique constraint.

### Tokens OAuth
- **Meta**: OAuth 2.0 → long-lived token (60 días) → refresh automático vía edge function semanal. Almacenado en tabla `integrations` (encrypted column o Supabase secret por workspace).
- **Google Ads / GA4**: OAuth 2.0 con refresh_token → refresh automático en cada sync si access_token expirado. Stored igual que Meta.
- Edge function de refresh corre antes de cada sync; si falla, marca integration como `status: error` y muestra badge en Connections.

---

## 3) DATA MODEL

### `workspaces`
| Campo | Tipo | Req | Index | Notas |
|-------|------|-----|-------|-------|
| id | uuid PK | ✅ | ✅ | |
| name | text | ✅ | | Nombre del cliente |
| slug | text | ✅ | ✅ unique | URL-friendly |
| currency | text | ✅ | | Default: USD |
| timezone | text | ✅ | | Default: America/Mexico_City |
| monthly_budget | numeric | | | Objetivo mensual de spend |
| created_at | timestamptz | ✅ | | |

### `users`
Usa `auth.users` de Supabase. No tabla custom.

### `user_roles`
| Campo | Tipo | Req | Index | Notas |
|-------|------|-----|-------|-------|
| id | uuid PK | ✅ | | |
| user_id | uuid FK→auth.users | ✅ | ✅ | ON DELETE CASCADE |
| role | app_role enum | ✅ | | admin, analyst, viewer |
| unique(user_id, role) | | | ✅ | |

### `workspace_members`
| Campo | Tipo | Req | Index | Notas |
|-------|------|-----|-------|-------|
| id | uuid PK | ✅ | | |
| workspace_id | uuid FK→workspaces | ✅ | ✅ | |
| user_id | uuid FK→auth.users | ✅ | ✅ | |
| role | text | ✅ | | owner, editor, viewer |
| unique(workspace_id, user_id) | | | ✅ | |

### `integrations`
| Campo | Tipo | Req | Index | Notas |
|-------|------|-----|-------|-------|
| id | uuid PK | ✅ | | |
| workspace_id | uuid FK | ✅ | ✅ | |
| platform | text | ✅ | | meta_ads, google_ads, ga4 |
| access_token | text | ✅ | | Encrypted |
| refresh_token | text | | | |
| token_expires_at | timestamptz | | | |
| status | text | ✅ | | active, error, expired |
| last_sync_at | timestamptz | | | |
| last_error | text | | | |
| created_at | timestamptz | ✅ | | |
| unique(workspace_id, platform) | | | ✅ | |

### `ad_accounts`
| Campo | Tipo | Req | Index | Notas |
|-------|------|-----|-------|-------|
| id | uuid PK | ✅ | | |
| workspace_id | uuid FK | ✅ | ✅ | |
| integration_id | uuid FK | ✅ | ✅ | |
| platform | text | ✅ | | |
| platform_account_id | text | ✅ | ✅ | |
| name | text | ✅ | | |
| currency | text | ✅ | | |
| is_active | boolean | ✅ | | |
| unique(platform, platform_account_id) | | | ✅ | |

### `campaigns`
| Campo | Tipo | Req | Index | Notas |
|-------|------|-----|-------|-------|
| id | uuid PK | ✅ | | |
| workspace_id | uuid FK | ✅ | ✅ | |
| ad_account_id | uuid FK | ✅ | ✅ | |
| platform | text | ✅ | ✅ | |
| platform_campaign_id | text | ✅ | ✅ | |
| name | text | ✅ | | |
| status | text | ✅ | | active, paused, archived |
| objective | text | | | |
| daily_budget | numeric | | | |
| lifetime_budget | numeric | | | |
| start_date | date | | | |
| end_date | date | | | |
| updated_at | timestamptz | ✅ | | |
| unique(platform, platform_campaign_id) | | | ✅ | |

### `adsets` (mismo patrón que campaigns + campaign_id FK)

### `ads` (mismo patrón + adset_id FK + creative_id FK)

### `creative_assets`
| Campo | Tipo | Req | Index | Notas |
|-------|------|-----|-------|-------|
| id | uuid PK | ✅ | | |
| workspace_id | uuid FK | ✅ | ✅ | |
| platform | text | ✅ | | |
| platform_creative_id | text | ✅ | ✅ | |
| asset_type | text | ✅ | | image, video, carousel |
| thumbnail_url | text | | | |
| source_url | text | | | URL original del asset |
| asset_hash | text | | ✅ | Para matching cross-platform |
| name | text | | | |

### `creative_tags`
| Campo | Tipo | Req | Index | Notas |
|-------|------|-----|-------|-------|
| id | uuid PK | ✅ | | |
| creative_asset_id | uuid FK | ✅ | ✅ | |
| workspace_id | uuid FK | ✅ | ✅ | |
| tag | text | ✅ | ✅ | e.g. "UGC", "promo", "testimonial" |
| unique(creative_asset_id, tag) | | | ✅ | |

### `performance_daily`
| Campo | Tipo | Req | Index | Notas |
|-------|------|-----|-------|-------|
| id | uuid PK | ✅ | | |
| workspace_id | uuid FK | ✅ | ✅ | |
| date | date | ✅ | ✅ | |
| platform | text | ✅ | ✅ | |
| ad_account_id | uuid FK | ✅ | | |
| campaign_id | uuid FK | | | |
| adset_id | uuid FK | | | |
| ad_id | uuid FK | | | |
| creative_asset_id | uuid FK | | | |
| impressions | bigint | | | |
| clicks | bigint | | | |
| spend | numeric | | | En moneda del workspace |
| conversions | numeric | | | |
| conversion_value | numeric | | | |
| ctr | numeric | | | Calculado en sync |
| cpc | numeric | | | |
| cpa | numeric | | | |
| roas | numeric | | | ROAS plataforma |
| source | text | ✅ | | "platform" o "ga4" |
| unique(platform, ad_account_id, campaign_id, adset_id, ad_id, date, source) | | | ✅ | |

### `finance_revenue`
| Campo | Tipo | Req | Index | Notas |
|-------|------|-----|-------|-------|
| id | uuid PK | ✅ | | |
| workspace_id | uuid FK | ✅ | ✅ | |
| date | date | ✅ | ✅ | |
| revenue | numeric | ✅ | | |
| orders | integer | | | |
| source | text | ✅ | | manual, shopify, api |
| notes | text | | | |

### `finance_costs`
| Campo | Tipo | Req | Index | Notas |
|-------|------|-----|-------|-------|
| id | uuid PK | ✅ | | |
| workspace_id | uuid FK | ✅ | ✅ | |
| date | date | ✅ | ✅ | |
| cost_type | text | ✅ | | cogs, shipping, fees, taxes, other |
| amount | numeric | ✅ | | |
| notes | text | | | |

### `changelog`
| Campo | Tipo | Req | Index | Notas |
|-------|------|-----|-------|-------|
| id | uuid PK | ✅ | | |
| workspace_id | uuid FK | ✅ | ✅ | |
| user_id | uuid FK | ✅ | | Quién registró |
| date | date | ✅ | ✅ | |
| change_type | text | ✅ | | budget, creative, targeting, bid, landing, copy, other |
| title | text | ✅ | | |
| description | text | | | |
| platform | text | | | |
| impact_notes | text | | | Qué pasó después |
| created_at | timestamptz | ✅ | | |

### `changelog_links`
| Campo | Tipo | Req | Index | Notas |
|-------|------|-----|-------|-------|
| id | uuid PK | ✅ | | |
| changelog_id | uuid FK | ✅ | ✅ | |
| entity_type | text | ✅ | | campaign, adset, ad, creative, landing |
| entity_id | uuid | ✅ | ✅ | |

### `experiments`
| Campo | Tipo | Req | Index | Notas |
|-------|------|-----|-------|-------|
| id | uuid PK | ✅ | | |
| workspace_id | uuid FK | ✅ | ✅ | |
| hypothesis | text | ✅ | | |
| status | text | ✅ | | draft, running, completed, cancelled |
| result | text | | | win, lose, inconclusive |
| decision | text | | | Qué se decidió |
| start_date | date | | | |
| end_date | date | | | |
| created_by | uuid FK | ✅ | | |
| created_at | timestamptz | ✅ | | |

### `alert_rules` (estructura lista, inactiva en V1)
| Campo | Tipo | Req | Index | Notas |
|-------|------|-----|-------|-------|
| id | uuid PK | ✅ | | |
| workspace_id | uuid FK | ✅ | ✅ | |
| metric | text | ✅ | | e.g. "cpa", "spend", "cvr" |
| condition | text | ✅ | | gt, lt, change_pct |
| threshold | numeric | ✅ | | |
| channel | text | ✅ | | slack, email |
| is_active | boolean | ✅ | | Default false en V1 |
| created_by | uuid FK | ✅ | | |

### `sync_log`
| Campo | Tipo | Req | Index | Notas |
|-------|------|-----|-------|-------|
| id | uuid PK | ✅ | | |
| workspace_id | uuid FK | ✅ | ✅ | |
| integration_id | uuid FK | ✅ | | |
| started_at | timestamptz | ✅ | ✅ | |
| finished_at | timestamptz | | | |
| status | text | ✅ | | running, success, partial, error |
| records_synced | integer | | | |
| error_message | text | | | |

---

## 4) PANTALLAS

### A) Login + Selección de Workspace
- **Objetivo**: Autenticar y elegir cliente
- **UI**: Formulario email/password → lista de workspaces asignados como cards
- **Empty state**: "No tienes workspaces asignados. Contacta a un admin."
- **Permisos**: Público (login), workspace list filtrado por membership
- **Criterio de aceptación**: Usuario logueado ve solo sus workspaces, selecciona uno y entra al dashboard

### B) Home — Client Scorecard
- **Objetivo**: Estado general del cliente en 10 segundos
- **UI**: 
  - KPI cards: Spend MTD, Revenue MTD, ROAS (plat), CAC, CPA, CVR
  - Pacing bar (spend vs budget mensual)
  - Health badges (verde/amarillo/rojo): tracking OK, spend activo, CVR normal
  - Lista de últimos 5 cambios de bitácora
  - Próximos pasos / notas del equipo
- **Filtros**: Rango de fechas, plataforma
- **Queries**: Aggregation de `performance_daily` por workspace + mes actual; último changelog
- **Empty state**: "Conecta tus plataformas para ver métricas"
- **Permisos**: Todos los roles del workspace

### C) Connections
- **Objetivo**: Conectar y monitorear integraciones
- **UI**: Cards por plataforma (Meta Ads, Google Ads, GA4) con estado (connected/error/expired), último sync, botón conectar/reconectar
- **Health**: Último sync exitoso, errores recientes, token expiry countdown
- **Queries**: `integrations` + `sync_log` últimos 5
- **Empty state**: Cards con botón "Conectar" prominente
- **Permisos**: admin y owner pueden conectar; analyst puede ver estado

### D) Performance Overview
- **Objetivo**: Vista táctica diaria de performance por plataforma
- **UI**:
  - Filtros: fecha, plataforma, cuenta, campaña
  - Tabs: "Por Plataforma" y "Total"
  - Tabla con campañas: spend, impressions, clicks, CTR, conversions, CPA, ROAS
  - Gráfico de líneas: spend + conversions over time
  - **Importante**: Badge claro "ROAS Plataforma" vs "ROAS GA4" en cada dato
- **Queries**: `performance_daily` agrupado por nivel seleccionado
- **Empty state**: "Sin datos para este rango. Verifica tus conexiones."
- **Permisos**: Todos

### E) Creative Performance
- **Objetivo**: Ranking de creativos para decidir qué escalar o pausar
- **UI**:
  - Tabla rankeada por ROAS o CPA (toggle)
  - Columnas: thumbnail, nombre, tipo, spend, conversions, CPA, ROAS, CTR
  - Tags editables (UGC, promo, testimonial, etc.)
  - Notas por creativo
  - Filtro por tag, plataforma, fecha
  - Breakdowns: por formato, por concepto (tag)
- **Queries**: `performance_daily` JOIN `creative_assets` JOIN `creative_tags`
- **Empty state**: "Los creativos aparecerán después del primer sync"
- **Permisos**: Todos ven, analyst+ editan tags/notas

### F) Finance & Unit Economics
- **Objetivo**: Conectar spend con revenue para ver margen real
- **UI**:
  - Cards: Revenue, Ad Spend, COGS, Other Costs, Contribution Margin, LTV/CAC
  - Tabla diaria: revenue, spend, gross margin, contribution margin
  - Input manual para revenue y costos (o futuro API)
  - Gráfico: revenue vs spend over time
  - Link a Growth Simulator / Unit Economics (si hay datos, mostrar output)
- **Fórmulas visibles**: Contribution Margin = Revenue - Ad Spend - COGS - Shipping - Fees - Taxes
- **Queries**: `finance_revenue` + `finance_costs` + `performance_daily` (spend total)
- **Empty state**: "Carga tu revenue y costos para ver el margen"
- **Permisos**: admin y analyst (viewer no ve finance)

### G) Bitácora (Change Log)
- **Objetivo**: Registro de cambios para correlacionar con métricas
- **UI**:
  - Timeline vertical con cambios
  - Formulario de nuevo cambio con template: tipo (budget/creative/targeting/bid/landing/copy), título, descripción, links a campañas/ads
  - Filtro por tipo, plataforma, fecha
  - Mini-gráfico de métricas antes/después del cambio (si hay datos)
- **Queries**: `changelog` + `changelog_links` + `performance_daily` para contexto
- **Empty state**: "Registra tu primer cambio para empezar a correlacionar"
- **Permisos**: analyst+ crean; todos ven

### H) Experiments Board
- **Objetivo**: Gestión ligera de tests e hipótesis
- **UI**: Kanban o tabla con columnas: Draft, Running, Completed
- Cards con: hipótesis, fechas, resultado (win/lose/inconclusive), decisión
- **Queries**: `experiments` filtrado por workspace
- **Empty state**: "¿Qué quieres probar esta semana?"
- **Permisos**: analyst+ crean; todos ven

### I) Admin
- **Objetivo**: Configuración del workspace
- **UI**:
  - Gestión de usuarios y roles del workspace
  - Definiciones de KPIs (editables): nombre, fórmula, unidad
  - Data mapping: naming conventions (cómo parsear nombres de campañas)
  - Configuración de moneda y timezone del workspace
  - Tabla de alert_rules (deshabilitadas en V1, UI lista)
- **Permisos**: Solo admin/owner

---

## 5) LÓGICAS CLAVE

### Normalización de métricas
- Diccionario central `metric_definitions` (hardcoded en V1, tabla en V1.5)
- Meta: `spend`, `actions[purchase]` → conversions, `action_values[purchase]` → conversion_value
- Google: `cost_micros / 1M` → spend, `conversions`, `conversions_value`
- GA4: `eventCount` para conversiones, `eventValue` para valor
- Fechas: convertir todo a timezone del workspace antes de guardar en `performance_daily.date`
- Moneda: convertir a moneda del workspace si difiere (tipo de cambio manual en V1)

### Identidad de Creative
- Paso 1: `platform_creative_id` por plataforma (nunca matchea cross-platform)
- Paso 2: `source_url` del asset → normalizar (quitar query params) → hash SHA256 → `asset_hash`
- Paso 3: Si `asset_hash` coincide entre plataformas → mismo creative_asset
- Fallback: matching manual por nombre/tag

### Pacing
- `burn_rate_daily = spend_mtd / days_elapsed`
- `projected_eom = burn_rate_daily * days_in_month`
- `deviation = projected_eom - monthly_budget` (mostrar % y absoluto)
- Badge: verde (<5% desvío), amarillo (5-15%), rojo (>15%)

### Anomaly Detection (reglas simples)
- CPA hoy > 1.5x CPA promedio últimos 7 días → flag
- Spend hoy = 0 cuando ayer > 0 → flag
- CVR drop > 40% vs promedio 7 días → flag
- Impressions = 0 en campaña activa → flag
- Almacenar flags en tabla `health_checks` (workspace_id, date, check_type, severity, entity_id, message)

### Health Checks
- GA4 events = 0 en últimas 24h → alerta tracking roto
- Integration token expira en < 7 días → alerta en Connections
- Último sync > 2h → alerta sync atrasado

### Capa Financiera
- **Contribution Margin** = Revenue - Ad Spend - COGS - Shipping - Platform Fees - Taxes
- **Contribution Margin %** = CM / Revenue × 100
- **Payback Period** = CAC / (Revenue per Customer per Month)
- **LTV/CAC Ratio** = LTV / CAC (donde LTV viene de Growth Simulator o input manual)

### Insights Accionables
- Template por métrica: "CPA subió 23% → revisar últimos cambios en bitácora → creativos con CPA > $X representan Y% del spend → acción: pausar/escalar"
- V1: manual, el analyst escribe. V1.5: auto-generado con lógica de templates.

---

## 6) JOBS / CRON / SYNC

### Job: `sync-meta-ads` (cada 60 min)
- Por cada workspace con integration Meta activa
- Refresh token si necesario
- Fetch campaigns, adsets, ads, creatives (incremental desde last_sync)
- Fetch insights (performance) para últimos 3 días (Meta puede ajustar datos 72h)
- Upsert en tablas normalizadas
- Actualizar `integrations.last_sync_at`
- Log en `sync_log`

### Job: `sync-google-ads` (cada 60 min)
- Mismo patrón que Meta
- Usar Google Ads API con refresh_token
- Fetch campaigns, ad_groups, ads, métricas (últimos 3 días)

### Job: `sync-ga4` (cada 60 min)
- Fetch GA4 Data API: sessions, conversions, revenue por date+source
- Mapear a `performance_daily` con source = "ga4"

### Job: `health-check` (cada 60 min, después de syncs)
- Correr reglas de anomaly detection
- Insertar en `health_checks`
- V2: disparar alertas Slack

### Job: `token-refresh` (cada 12h)
- Revisar tokens que expiran en < 24h
- Intentar refresh
- Si falla, marcar integration como `status: error`

### Manejo de errores
- Retry x3 con backoff exponencial (1s, 5s, 25s)
- Si falla después de 3 intentos: `sync_log.status = 'error'`, `integrations.last_error = message`
- Nunca bloquear otros workspaces: cada workspace se sincroniza independientemente
- Rate limit hit: esperar el tiempo indicado por el header `Retry-After`

---

## 7) QA CHECKLIST

- [ ] **Daily totals**: SUM(performance_daily) por día = total reportado por plataforma (spot check manual)
- [ ] **Duplicados**: COUNT vs COUNT DISTINCT en (platform, entity_id, date, source) = 0 duplicados
- [ ] **Timezone**: Todos los dates en performance_daily corresponden al timezone del workspace, no UTC
- [ ] **Currency**: Spend en moneda del workspace. Si la cuenta es en otra moneda, verificar conversión
- [ ] **Missing days**: Para campañas activas, no hay gaps en performance_daily (generar fila con 0s si la API no devuelve)
- [ ] **GA4 events**: eventCount > 0 para días con tráfico conocido
- [ ] **Reconciliación**: Spend total del mes ≈ factura de la plataforma (< 2% diferencia aceptable)
- [ ] **Token health**: Todas las integraciones activas tienen token válido
- [ ] **RLS**: Usuario de workspace A no puede ver datos de workspace B (test manual)
- [ ] **Sync lag**: last_sync_at nunca > 90 min para integraciones activas

---

## 8) BACKLOG DE FEATURES

| # | Feature | Prioridad | Por qué |
|---|---------|-----------|---------|
| 1 | Alertas Slack configurables | P0 | Enterarte de problemas sin abrir la app |
| 2 | Auto-pause campaigns por CPA | P0 | Evitar quemar presupuesto mientras duermes |
| 3 | Blended ROAS con ponderación configurable | P1 | Vista unificada para clientes que lo piden |
| 4 | Integración Shopify para revenue automático | P1 | Eliminar input manual de ventas |
| 5 | AI summary semanal por cliente | P1 | Reporte ejecutivo en 30 segundos |
| 6 | Naming convention parser automático | P1 | Extraer geo/audience/funnel del nombre de campaña |
| 7 | Comparativo entre periodos (WoW, MoM) | P1 | Contexto temporal para cada métrica |
| 8 | Dashboard multi-cliente para managers | P1 | Ver todos los clientes en una sola vista |
| 9 | Audience insights desde Meta/Google | P2 | Entender a quién le funciona qué |
| 10 | Landing page tracker (cambios de LP + impacto) | P2 | Correlacionar cambios de landing con CVR |
| 11 | Export PDF branded por cliente | P2 | Entregar reportes a clientes externos si se necesita |
| 12 | Webhook para datos de CRM/ERP | P2 | Automatizar la capa financiera |

---

## 9) DECISIONES

| # | Decisión | Default Recomendado | Notas |
|---|----------|---------------------|-------|
| 1 | ¿OAuth directo o usar Lovable connectors para Meta/Google? | OAuth directo via edge functions (más control sobre scopes y refresh) | Lovable connector no cubre Google Ads API completa |
| 2 | ¿Moneda base para todos los workspaces? | USD (configurable por workspace) | V1 sin conversión automática |
| 3 | ¿Timezone default? | America/Mexico_City | Configurable por workspace |
| 4 | ¿Granularidad mínima de datos? | Diaria (no hourly) | Reduce storage 24x, suficiente para decisiones |
| 5 | ¿Revenue input manual o API? | Manual en V1, Shopify API en backlog | Pragmático para arrancar |
| 6 | ¿Growth Simulator / Unit Economics como módulos dentro de esta app o links externos? | Links externos con datos compartidos vía DB | No reconstruir, solo leer/escribir tablas compartidas |
| 7 | ¿Almacenar tokens OAuth en tabla (encrypted) o Supabase secrets? | Tabla `integrations` con columna encrypted (permite multi-tenant dinámico) | Secrets son globales, no por workspace |
| 8 | ¿GA4 via Data API o BigQuery export? | Data API (más simple, sin setup de BQ) | BQ en backlog si necesitan raw events |
| 9 | ¿Creative matching cross-platform automático o manual? | Semi-auto: hash de URL + fallback manual | Full auto requiere image hashing (V2) |
| 10 | ¿Empezar con Supabase Cloud de Lovable o Supabase externo? | Supabase Cloud de Lovable (integrado, menos setup) | Migrar a externo si crece mucho |

