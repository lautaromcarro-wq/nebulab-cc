# Dashboard Improvements — Semáforos + % Comparison

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add traffic-light (semáforo) coloring and period % comparison to all KPI cards across Home, Finance, and Performance dashboards so every metric has instant visual status at a glance.

**Architecture:** A shared `semaforo.ts` utility provides threshold-based color classes for each KPI type. `DeltaBadge` is extracted to a shared component to eliminate duplication. Finance.tsx gains a parallel prev-period query. Home.tsx secondary KPIs get delta badges. All value text gets semáforo coloring.

**Tech Stack:** React, TypeScript, Tailwind CSS (via shadcn/ui tokens: text-success, text-warning, text-destructive), date-fns, @tanstack/react-query

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/lib/semaforo.ts` | Threshold-based color + label per KPI type |
| Create | `src/components/DeltaBadge.tsx` | Shared delta % indicator (extracted from Home/Performance) |
| Modify | `src/pages/Home.tsx` | Add semáforo to secondary KPIs + delta on all cards |
| Modify | `src/pages/Finance.tsx` | Add prev-period query + delta badges to all hero KPIs |
| Modify | `src/pages/Performance.tsx` | Remove local DeltaBadge, use shared + semáforo on ROAS values |

---

### Task 1: Create semaforo utility

**Files:**
- Create: `src/lib/semaforo.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/semaforo.ts
// Threshold-based traffic light color for KPI values.
// Returns Tailwind text-* class names matching shadcn/ui color tokens.

export type SemaforoColor = "text-success" | "text-warning" | "text-destructive" | "text-muted-foreground";

/** Returns the semáforo color class for a ROAS value. */
export function roasColor(roas: number): SemaforoColor {
  if (roas >= 3) return "text-success";
  if (roas >= 1.5) return "text-warning";
  if (roas > 0) return "text-destructive";
  return "text-muted-foreground";
}

/** Returns the semáforo color class for a margin % value. */
export function marginColor(pct: number): SemaforoColor {
  if (pct >= 20) return "text-success";
  if (pct >= 0) return "text-warning";
  return "text-destructive";
}

/** Returns the semáforo color class for a CTR % value. */
export function ctrColor(ctr: number): SemaforoColor {
  if (ctr >= 2) return "text-success";
  if (ctr >= 0.8) return "text-warning";
  if (ctr > 0) return "text-destructive";
  return "text-muted-foreground";
}

/** Returns the semáforo color for a CPA/CPL — lower is better.
 *  Needs a baseline reference; without one, uses delta direction only.
 *  Use roasColor or marginColor for absolute thresholds. */
export function deltaColor(delta: number | null, inverse = false): SemaforoColor {
  if (delta === null) return "text-muted-foreground";
  const neutral = Math.abs(delta) < 0.5;
  if (neutral) return "text-muted-foreground";
  const positive = inverse ? delta < 0 : delta > 0;
  return positive ? "text-success" : "text-destructive";
}

/** Returns the semáforo label (tooltip text) for a ROAS value. */
export function roasLabel(roas: number): string {
  if (roas >= 3) return "Excelente";
  if (roas >= 1.5) return "Aceptable";
  if (roas > 0) return "Bajo — revisar";
  return "Sin datos";
}

/** Returns the semáforo label for margin %. */
export function marginLabel(pct: number): string {
  if (pct >= 20) return "Margen saludable";
  if (pct >= 0) return "Margen ajustado";
  return "Margen negativo";
}
```

- [ ] **Step 2: Verify no import errors**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors in semaforo.ts

- [ ] **Step 3: Commit**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && git add src/lib/semaforo.ts && git commit -m "feat: add semaforo utility with threshold-based KPI color helpers"
```

---

### Task 2: Extract shared DeltaBadge component

**Files:**
- Create: `src/components/DeltaBadge.tsx`

- [ ] **Step 1: Create the shared component**

```typescript
// src/components/DeltaBadge.tsx
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

function delta(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

interface DeltaBadgeProps {
  current: number;
  prev: number;
  /** Set true when lower is better (e.g. CPA, CPM, bounce rate) */
  inverse?: boolean;
  /** Show value text only, no icon */
  compact?: boolean;
}

export function DeltaBadge({ current, prev, inverse = false, compact = false }: DeltaBadgeProps) {
  const d = delta(current, prev);
  if (d === null) return <span className="text-[10px] text-muted-foreground">–</span>;
  const positive = inverse ? d < 0 : d > 0;
  const neutral = Math.abs(d) < 0.5;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-medium",
      neutral ? "text-muted-foreground" : positive ? "text-success" : "text-destructive",
    )}>
      {!compact && (neutral ? <Minus className="h-2.5 w-2.5" /> : positive ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />)}
      {Math.abs(d).toFixed(1)}%
    </span>
  );
}
```

- [ ] **Step 2: Update Performance.tsx to use shared DeltaBadge**

In `src/pages/Performance.tsx`:
- Remove the local `delta` function and `DeltaBadge` component (lines 57-76)
- Add import: `import { DeltaBadge } from "@/components/DeltaBadge";`

- [ ] **Step 3: Update Home.tsx to use shared DeltaBadge**

In `src/pages/Home.tsx`:
- Remove the local `delta` function and `DeltaBadge` component (lines 45-64)
- Add import: `import { DeltaBadge } from "@/components/DeltaBadge";`

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && git add src/components/DeltaBadge.tsx src/pages/Performance.tsx src/pages/Home.tsx && git commit -m "refactor: extract shared DeltaBadge component, remove duplication"
```

---

### Task 3: Add semáforo + delta to Finance.tsx

Finance currently has no period comparison. We need to add prev-period query and delta badges to all 4 hero KPIs, plus semáforo coloring on values.

**Files:**
- Modify: `src/pages/Finance.tsx`

- [ ] **Step 1: Add DeltaBadge import and prev-period query to useFinanceData**

In `src/pages/Finance.tsx`, update `useFinanceData`:

Add imports at the top:
```typescript
import { DeltaBadge } from "@/components/DeltaBadge";
import { differenceInDays, subDays } from "date-fns";
import { marginColor, roasColor } from "@/lib/semaforo";
```

Update the `FinanceData` interface to add prev period fields:
```typescript
interface FinanceData {
  totalRevenue: number;
  totalSpend: number;
  totalAdditionalCosts: number;
  contributionMargin: number;
  marginPercent: number;
  orders: number;
  costRows: CostRow[];
  daily: Array<{ date: string; revenue: number; spend: number }>;
  finSettings: FinancialSettings;
  // prev period
  prevRevenue: number;
  prevSpend: number;
  prevContributionMargin: number;
  prevMarginPercent: number;
}
```

Update `emptyFinance()`:
```typescript
function emptyFinance(): FinanceData {
  return {
    totalRevenue: 0, totalSpend: 0, totalAdditionalCosts: 0,
    contributionMargin: 0, marginPercent: 0, orders: 0,
    costRows: [], daily: [], finSettings: defaultFinSettings,
    prevRevenue: 0, prevSpend: 0, prevContributionMargin: 0, prevMarginPercent: 0,
  };
}
```

- [ ] **Step 2: Add prev-period parallel query inside useFinanceData queryFn**

After the `const fromStr`/`toStr` declarations, add:
```typescript
const daysCount = differenceInDays(dateRange.to, dateRange.from) + 1;
const prevFromStr = format(subDays(dateRange.from, daysCount), "yyyy-MM-dd");
const prevToStr = format(subDays(dateRange.from, 1), "yyyy-MM-dd");
```

Add two more queries to the `Promise.all` array (5th and 6th):
```typescript
// 5th: prev revenue
(() => {
  let q = supabase
    .from("workspace_revenue_daily")
    .select("date, total_revenue, total_purchases, client_id")
    .eq("workspace_id", currentWorkspace.id)
    .gte("date", prevFromStr)
    .lte("date", prevToStr);
  if (clientId) q = (q as unknown as typeof q).eq("client_id", clientId);
  return q;
})(),
// 6th: prev spend
(() => {
  let q = supabase
    .from("performance_daily")
    .select("date, spend")
    .eq("workspace_id", currentWorkspace.id)
    .gte("date", prevFromStr)
    .lte("date", prevToStr);
  if (clientId) q = q.eq("client_id", clientId);
  return q;
})(),
```

Destructure as `[revResult, costsResult, perfResult, finResult, prevRevResult, prevPerfResult]`.

Compute prev totals after existing computations:
```typescript
const prevRevenueRows = (prevRevResult.data ?? []) as RevenueRow[];
const prevRevenue = prevRevenueRows.reduce((s, r) => s + (Number(r.total_revenue) || 0), 0);
const prevPerfRows = prevPerfResult.data ?? [];
const prevSpendByDate = new Map<string, number>();
for (const p of prevPerfRows) {
  prevSpendByDate.set(p.date, (prevSpendByDate.get(p.date) ?? 0) + (Number(p.spend) || 0));
}
const prevSpend = Array.from(prevSpendByDate.values()).reduce((s, v) => s + v, 0);
const prevSettingsDeductions =
  prevRevenue * (finSettings.avg_cogs_percent / 100) +
  prevRevenue * (finSettings.shipping_percent / 100) +
  prevRevenue * (finSettings.payment_fee_percent / 100) +
  prevRevenue * (finSettings.refund_percent / 100) +
  prevRevenue * (finSettings.iva_percent / 100);
const prevContributionMargin = prevRevenue - prevSpend - prevSettingsDeductions;
const prevMarginPercent = prevRevenue > 0 ? (prevContributionMargin / prevRevenue) * 100 : 0;
```

Add to return:
```typescript
return {
  ...,
  prevRevenue,
  prevSpend,
  prevContributionMargin,
  prevMarginPercent,
};
```

- [ ] **Step 3: Update Finance hero KPI cards with delta badges and semáforo colors**

Replace the hero KPIs section in the Finance render (the 4 StatCards) with:
```tsx
{/* Hero KPIs */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <Card>
    <CardContent className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Revenue</p>
      <p className="text-xl font-bold text-success">{fmtCurrency(data!.totalRevenue)}</p>
      <div className="mt-1"><DeltaBadge current={data!.totalRevenue} prev={data!.prevRevenue} /></div>
    </CardContent>
  </Card>
  <Card>
    <CardContent className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Ad Spend</p>
      <p className="text-xl font-bold text-primary">{fmtCurrency(data!.totalSpend)}</p>
      <div className="mt-1"><DeltaBadge current={data!.totalSpend} prev={data!.prevSpend} inverse /></div>
    </CardContent>
  </Card>
  <Card>
    <CardContent className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Contribution Margin</p>
      <p className={cn("text-xl font-bold", data!.contributionMargin >= 0 ? "text-success" : "text-destructive")}>
        {fmtCurrency(data!.contributionMargin)}
      </p>
      <div className="mt-1"><DeltaBadge current={data!.contributionMargin} prev={data!.prevContributionMargin} /></div>
    </CardContent>
  </Card>
  <Card>
    <CardContent className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Margin %</p>
      <p className={cn("text-xl font-bold", marginColor(data!.marginPercent))}>
        {fmt(data!.marginPercent, 1)}%
      </p>
      <div className="mt-1"><DeltaBadge current={data!.marginPercent} prev={data!.prevMarginPercent} /></div>
    </CardContent>
  </Card>
</div>
```

Also add `cn` import if not already present: `import { cn } from "@/lib/utils";`
Remove old StatCard imports for Finance hero section (keep StatCard for secondary KPIs below).

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && git add src/pages/Finance.tsx && git commit -m "feat(finance): add period comparison delta badges + semáforo color to hero KPIs"
```

---

### Task 4: Improve Home.tsx — semáforo on secondary KPIs + ROAS coloring

**Files:**
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: Import semaforo utilities**

Add to imports in `src/pages/Home.tsx`:
```typescript
import { roasColor, marginColor } from "@/lib/semaforo";
```

- [ ] **Step 2: Add delta badges to secondary KPI row**

Replace the secondary KPIs section (grid-cols-3 md:grid-cols-6) in Home.tsx. Currently it's 6 `StatCard` components with no delta. Update to include `DeltaBadge`:

```tsx
{/* Secondary KPIs */}
<div className="grid grid-cols-3 md:grid-cols-6 gap-2">
  <Card>
    <CardContent className="p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Blended ROAS</p>
      <p className={cn("text-sm font-bold", roasColor(totals.blendedRoas))}>{fmt(totals.blendedRoas, 2)}x</p>
      {prevTotals && <div className="mt-0.5"><DeltaBadge current={totals.blendedRoas} prev={prevTotals.blendedRoas} /></div>}
    </CardContent>
  </Card>
  <Card>
    <CardContent className="p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">ROAS Meta</p>
      <p className={cn("text-sm font-bold", roasColor(totals.roasMeta))}>{fmt(totals.roasMeta, 2)}x</p>
      {prevTotals && <div className="mt-0.5"><DeltaBadge current={totals.roasMeta} prev={prevTotals.roasMeta} /></div>}
    </CardContent>
  </Card>
  <Card>
    <CardContent className="p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">ROAS Google</p>
      <p className={cn("text-sm font-bold", roasColor(totals.roasGoogle))}>{fmt(totals.roasGoogle, 2)}x</p>
      {prevTotals && <div className="mt-0.5"><DeltaBadge current={totals.roasGoogle} prev={prevTotals.roasGoogle} /></div>}
    </CardContent>
  </Card>
  <Card>
    <CardContent className="p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Impressions</p>
      <p className="text-sm font-bold">{fmtCompact(totals.totalImpressions)}</p>
      {prevTotals && <div className="mt-0.5"><DeltaBadge current={totals.totalImpressions} prev={prevTotals.totalImpressions} /></div>}
    </CardContent>
  </Card>
  <Card>
    <CardContent className="p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">CTR</p>
      <p className="text-sm font-bold">{fmt(totals.ctr, 2)}%</p>
      {prevTotals && <div className="mt-0.5"><DeltaBadge current={totals.ctr} prev={prevTotals.ctr} /></div>}
    </CardContent>
  </Card>
  <Card>
    <CardContent className="p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Purchases</p>
      <p className="text-sm font-bold">{fmt(totals.totalPurchases)}</p>
      {prevTotals && <div className="mt-0.5"><DeltaBadge current={totals.totalPurchases} prev={prevTotals.totalPurchases} /></div>}
    </CardContent>
  </Card>
</div>
```

Remove unused `StatCard` import if no longer used for these 6 cards (check rest of Home.tsx — StatCard is still used for "Clientes Activos" header card so keep the import).

- [ ] **Step 3: Add semáforo color to SegmentCard ROAS**

In the `SegmentCard` component, find the `MetricCell` for ROAS:
```tsx
<MetricCell label="ROAS" value={`${fmt(card.roas, 2)}x`} />
```

Replace with a colored version:
```tsx
<div>
  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">ROAS</p>
  <p className={cn("text-sm font-bold", roasColor(card.roas))}>{fmt(card.roas, 2)}x</p>
</div>
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && git add src/pages/Home.tsx && git commit -m "feat(home): semáforo ROAS colors + delta badges on secondary KPIs and segment cards"
```

---

### Task 5: Improve Performance.tsx — semáforo on ROAS values in KpiCard

Performance already has DeltaBadge (now shared). Add semáforo color to the value text for ROAS cards.

**Files:**
- Modify: `src/pages/Performance.tsx`

- [ ] **Step 1: Add semaforo import**

Add to imports:
```typescript
import { roasColor, ctrColor } from "@/lib/semaforo";
```

- [ ] **Step 2: Add `semaforo` prop to KpiCard and apply to value text**

Update the `KpiCard` component to accept an optional color class:
```tsx
function KpiCard({
  label, value, prev, current, inverse = false, tooltip, valueColor,
}: {
  label: string; value: string; prev: number; current: number;
  inverse?: boolean; tooltip?: string; valueColor?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className={cn("text-xl font-bold tracking-tight", valueColor)}>{value}</p>
        <div className="mt-1">
          <DeltaBadge current={current} prev={prev} inverse={inverse} />
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Pass valueColor to ROAS KpiCards in MetaTab and GoogleTab**

In `MetaTab`, update the ROAS KpiCard:
```tsx
<KpiCard
  label="ROAS"
  value={`${fmt(totals.roas, 2)}x`}
  current={totals.roas} prev={prevTotals.roas}
  tooltip="Revenue plataforma / Spend. Validar contra GA4."
  valueColor={roasColor(totals.roas)}
/>
```

In `MetaTab`, update CTR:
```tsx
<KpiCard
  label="CTR link"
  value={fmtPercent(totals.ctr)}
  current={totals.ctr} prev={prevTotals.ctr}
  valueColor={ctrColor(totals.ctr)}
/>
```

- [ ] **Step 4: Apply roasColor in CampaignTable ROAS cells**

The existing `roasStatus` function returns the same classes as `roasColor`. Remove `roasStatus` and replace its 3 usages with `roasColor` from semaforo:
- Remove local `roasStatus` function
- Replace `roasStatus(c.roas)` → `roasColor(c.roas)` and `roasStatus(card.roas)` → `roasColor(card.roas)`

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && git add src/pages/Performance.tsx && git commit -m "feat(performance): semáforo colors on ROAS/CTR values, use shared roasColor utility"
```

---

### Task 6: Final verification

- [ ] **Step 1: Build check**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && npm run build 2>&1 | tail -20
```
Expected: Build successful, no errors

- [ ] **Step 2: Push**

```bash
cd /Users/lautcro/Documents/mi-proyecto/nebulab-command-center && git push
```

Expected: Push successful
