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
