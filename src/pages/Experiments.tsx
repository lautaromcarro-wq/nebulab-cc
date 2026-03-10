import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import SectionHeader from "@/components/SectionHeader";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus, XCircle, HelpCircle, TrendingUp, Link2,
  Sparkles, Loader2, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type ExperimentStatus = "planned" | "running" | "done" | "killed";
type ExperimentDecision = "scale" | "iterate" | "stop" | "unknown" | null;

interface Experiment {
  id: string;
  hypothesis: string;
  description: string | null;
  platform: string;
  metric_primary: string;
  baseline_value: number | null;
  final_value: number | null;
  ai_insight: string | null;
  status: ExperimentStatus;
  decision: ExperimentDecision;
  result_summary: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  owner_id: string;
  linked_changelog_id: string | null;
  changelog_title?: string | null;
}

interface ChangelogOption {
  id: string;
  title: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_OPTIONS = [
  { value: "general",    label: "General" },
  { value: "meta",       label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "tiktok",     label: "TikTok Ads" },
  { value: "ga4",        label: "Web / GA4" },
  { value: "email",      label: "Email" },
  { value: "organico",   label: "Orgánico" },
];

const PLATFORM_COLORS: Record<string, string> = {
  meta:       "bg-blue-500/10 text-blue-600 border-blue-200",
  google_ads: "bg-green-500/10 text-green-600 border-green-200",
  tiktok:     "bg-zinc-800/10 text-zinc-700 border-zinc-300",
  ga4:        "bg-orange-500/10 text-orange-600 border-orange-200",
  email:      "bg-purple-500/10 text-purple-600 border-purple-200",
  organico:   "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  general:    "bg-muted text-muted-foreground border-0",
};

const KPI_OPTIONS = [
  { value: "ROAS",             label: "ROAS" },
  { value: "ROAS blended",     label: "ROAS blended" },
  { value: "CPA",              label: "CPA ($)" },
  { value: "CAC",              label: "CAC ($)" },
  { value: "CTR",              label: "CTR (%)" },
  { value: "CVR",              label: "CVR / Conv. rate (%)" },
  { value: "CPM",              label: "CPM ($)" },
  { value: "CPC",              label: "CPC ($)" },
  { value: "Revenue",          label: "Revenue ($)" },
  { value: "Spend",            label: "Spend ($)" },
  { value: "Compras",          label: "Compras" },
  { value: "Impresiones",      label: "Impresiones" },
  { value: "Clics",            label: "Clics" },
  { value: "AOV",              label: "AOV ($)" },
  { value: "Sesiones",         label: "Sesiones" },
  { value: "Otro",             label: "Otro" },
];

const statusConfig: Record<ExperimentStatus, { label: string; className: string; col: string }> = {
  planned: { label: "Planeado",  className: "bg-muted text-muted-foreground border-0",                    col: "Planeados"  },
  running: { label: "En curso",  className: "bg-info/10 text-info border-info/20",                        col: "En Curso"   },
  done:    { label: "Terminado", className: "bg-success/10 text-success border-success/20",               col: "Terminados" },
  killed:  { label: "Cancelado", className: "bg-destructive/10 text-destructive border-destructive/20",   col: "Cancelados" },
};

const decisionConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  scale:   { label: "Escalar",      icon: TrendingUp, className: "text-success"          },
  iterate: { label: "Iterar",       icon: HelpCircle, className: "text-warning"           },
  stop:    { label: "Detener",      icon: XCircle,    className: "text-destructive"       },
  unknown: { label: "Sin decisión", icon: HelpCircle, className: "text-muted-foreground"  },
};

const COLUMNS: ExperimentStatus[] = ["planned", "running", "done", "killed"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeVariation(baseline: number | null, final: number | null): number | null {
  if (baseline == null || final == null || baseline === 0) return null;
  return ((final - baseline) / Math.abs(baseline)) * 100;
}

function VariationBadge({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const Icon = pct > 0.5 ? ArrowUpRight : pct < -0.5 ? ArrowDownRight : Minus;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums",
      pct >= 0 ? "text-success" : "text-destructive"
    )}>
      <Icon className="h-3 w-3" />
      {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useExperiments() {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["experiments", currentWorkspace?.id],
    queryFn: async (): Promise<Experiment[]> => {
      if (!currentWorkspace) return [];
      const { data, error } = await supabase
        .from("experiments")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const items = (data ?? []) as any[];
      const changelogIds = items.map((e) => e.linked_changelog_id).filter(Boolean) as string[];
      if (changelogIds.length > 0) {
        const { data: cl } = await supabase.from("changelog").select("id, title").in("id", changelogIds);
        const clMap = new Map((cl ?? []).map((c) => [c.id, c.title]));
        return items.map((e) => ({ ...e, changelog_title: e.linked_changelog_id ? (clMap.get(e.linked_changelog_id) ?? null) : null }));
      }
      return items as Experiment[];
    },
    enabled: !!currentWorkspace,
  });
}

function useChangelogOptions() {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["changelog-options", currentWorkspace?.id],
    queryFn: async (): Promise<ChangelogOption[]> => {
      if (!currentWorkspace) return [];
      const { data } = await supabase
        .from("changelog")
        .select("id, title")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as ChangelogOption[];
    },
    enabled: !!currentWorkspace,
  });
}

// ── New Experiment Dialog ─────────────────────────────────────────────────────

function NewExperimentDialog({
  workspaceId, userId, onSuccess,
}: { workspaceId: string; userId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    hypothesis: "", description: "", platform: "general",
    metric_primary: "ROAS", baseline_value: "",
    start_date: "", end_date: "", linked_changelog_id: "none",
  });
  const [loading, setLoading] = useState(false);
  const { data: changelogOptions = [] } = useChangelogOptions();

  const handleSubmit = async () => {
    if (!form.hypothesis.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("experiments").insert({
      workspace_id: workspaceId,
      owner_id: userId,
      hypothesis: form.hypothesis.trim(),
      description: form.description.trim() || null,
      platform: form.platform,
      metric_primary: form.metric_primary,
      baseline_value: form.baseline_value ? Number(form.baseline_value) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: "planned",
      linked_changelog_id: form.linked_changelog_id === "none" ? null : form.linked_changelog_id,
    } as any);
    setLoading(false);
    if (error) { toast.error("Error al crear experimento"); return; }
    toast.success("Experimento creado");
    setOpen(false);
    setForm({ hypothesis: "", description: "", platform: "general", metric_primary: "ROAS", baseline_value: "", start_date: "", end_date: "", linked_changelog_id: "none" });
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs gap-1">
          <Plus className="h-3.5 w-3.5" /> Nuevo Experimento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuevo Experimento</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label>Hipótesis <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Si hacemos X en plataforma Y, esperamos que Z porque..."
              value={form.hypothesis}
              onChange={(e) => setForm((p) => ({ ...p, hypothesis: e.target.value }))}
              rows={2}
            />
          </div>
          <div>
            <Label>Descripción / Contexto <span className="text-muted-foreground text-[10px]">(opcional)</span></Label>
            <Textarea
              placeholder="Detalle del cambio, audiencia afectada, contexto relevante..."
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Plataforma</Label>
              <Select value={form.platform} onValueChange={(v) => setForm((p) => ({ ...p, platform: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>KPI a medir</Label>
              <Select value={form.metric_primary} onValueChange={(v) => setForm((p) => ({ ...p, metric_primary: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KPI_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>
              Valor actual de <strong>{form.metric_primary}</strong>
              <span className="text-muted-foreground ml-1 text-[10px]">(baseline — antes del experimento)</span>
            </Label>
            <Input
              type="number"
              placeholder={form.metric_primary === "ROAS" ? "Ej: 3.5" : form.metric_primary.includes("%") ? "Ej: 2.4" : "0.00"}
              value={form.baseline_value}
              onChange={(e) => setForm((p) => ({ ...p, baseline_value: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Inicio</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div>
              <Label>Fecha de análisis</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Vincular a Bitácora <span className="text-muted-foreground text-[10px]">(opcional)</span></Label>
            <Select value={form.linked_changelog_id} onValueChange={(v) => setForm((p) => ({ ...p, linked_changelog_id: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin vincular</SelectItem>
                {changelogOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={loading || !form.hypothesis.trim()}>
            {loading ? "Creando…" : "Crear Experimento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit / Close Experiment Dialog ────────────────────────────────────────────

function EditExperimentDialog({ exp, onSuccess }: { exp: Experiment; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    status: exp.status,
    decision: exp.decision ?? "unknown",
    result_summary: exp.result_summary ?? "",
    final_value: exp.final_value != null ? String(exp.final_value) : "",
    ai_insight: exp.ai_insight ?? "",
    linked_changelog_id: exp.linked_changelog_id ?? "none",
  });
  const [loading, setLoading] = useState(false);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const { data: changelogOptions = [] } = useChangelogOptions();

  const finalValueNum = form.final_value ? Number(form.final_value) : null;
  const variationPct = computeVariation(exp.baseline_value, finalValueNum);
  const canGenerateInsight = exp.baseline_value != null && finalValueNum != null;

  const handleGenerateInsight = async () => {
    if (!canGenerateInsight) return;
    setGeneratingInsight(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-experiment-insight", {
        body: {
          hypothesis: exp.hypothesis,
          description: exp.description,
          platform: exp.platform ?? "general",
          kpi: exp.metric_primary,
          baseline: exp.baseline_value,
          final_value: finalValueNum,
          variation_pct: variationPct ?? 0,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.insight) {
        setForm((p) => ({ ...p, ai_insight: data.insight }));
        toast.success("Insight generado");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Error al generar insight");
    } finally {
      setGeneratingInsight(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase.from("experiments").update({
      status: form.status as ExperimentStatus,
      decision: form.decision === "unknown" ? null : form.decision as ExperimentDecision,
      result_summary: form.result_summary || null,
      final_value: finalValueNum,
      ai_insight: form.ai_insight || null,
      linked_changelog_id: form.linked_changelog_id === "none" ? null : form.linked_changelog_id,
    } as any).eq("id", exp.id);
    setLoading(false);
    if (error) { toast.error("Error al actualizar"); return; }
    toast.success("Actualizado");
    setOpen(false);
    onSuccess();
  };

  const closingExperiment = form.status === "done" || form.status === "killed";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
          Actualizar
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Actualizar Experimento</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground line-clamp-2">{exp.hypothesis}</p>

        <div className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as ExperimentStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planeado</SelectItem>
                  <SelectItem value="running">En curso</SelectItem>
                  <SelectItem value="done">Terminado</SelectItem>
                  <SelectItem value="killed">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Decisión</Label>
              <Select value={form.decision} onValueChange={(v) => setForm((p) => ({ ...p, decision: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Sin decisión</SelectItem>
                  <SelectItem value="scale">Escalar</SelectItem>
                  <SelectItem value="iterate">Iterar</SelectItem>
                  <SelectItem value="stop">Detener</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cierre: valor final + variación + IA */}
          {closingExperiment && (
            <div className="rounded-lg border border-dashed p-3 space-y-3 bg-muted/30">
              <p className="text-xs font-semibold">Resultados del experimento</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px]">Baseline de {exp.metric_primary}</Label>
                  <Input
                    type="number"
                    value={exp.baseline_value ?? ""}
                    disabled
                    className="bg-muted/50 text-muted-foreground text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Valor final de {exp.metric_primary}</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={form.final_value}
                    onChange={(e) => setForm((p) => ({ ...p, final_value: e.target.value }))}
                  />
                </div>
              </div>

              {variationPct != null && (
                <div className="flex items-center gap-2 rounded-md bg-background border px-3 py-2">
                  <span className="text-xs text-muted-foreground">Variación:</span>
                  <VariationBadge pct={variationPct} />
                  <span className="text-xs text-muted-foreground ml-auto">
                    {exp.baseline_value} → {form.final_value} ({exp.metric_primary})
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-[11px]">Insight con IA</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={handleGenerateInsight}
                    disabled={generatingInsight || !canGenerateInsight}
                  >
                    {generatingInsight
                      ? <><Loader2 className="h-3 w-3 animate-spin" />Generando…</>
                      : <><Sparkles className="h-3 w-3" />Generar</>
                    }
                  </Button>
                </div>
                <Textarea
                  placeholder="El insight aparecerá aquí. También podés escribirlo manualmente."
                  value={form.ai_insight}
                  onChange={(e) => setForm((p) => ({ ...p, ai_insight: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
          )}

          <div>
            <Label>Notas / Resumen</Label>
            <Textarea
              placeholder="¿Qué pasó? ¿Qué aprendimos?"
              value={form.result_summary}
              onChange={(e) => setForm((p) => ({ ...p, result_summary: e.target.value }))}
              rows={2}
            />
          </div>

          <div>
            <Label>Vincular a Bitácora</Label>
            <Select value={form.linked_changelog_id} onValueChange={(v) => setForm((p) => ({ ...p, linked_changelog_id: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin vincular</SelectItem>
                {changelogOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" onClick={handleSave} disabled={loading}>
            {loading ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Experiment Card ───────────────────────────────────────────────────────────

function ExperimentCard({ exp, onSuccess }: { exp: Experiment; onSuccess: () => void }) {
  const status = statusConfig[exp.status];
  const decision = exp.decision ? decisionConfig[exp.decision] : null;
  const DecisionIcon = decision?.icon;
  const variationPct = computeVariation(exp.baseline_value, exp.final_value);
  const platformColor = PLATFORM_COLORS[exp.platform ?? "general"] ?? PLATFORM_COLORS.general;
  const platformLabel = PLATFORM_OPTIONS.find((o) => o.value === exp.platform)?.label ?? exp.platform;

  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 space-y-2">
        <p className="text-xs font-medium leading-snug">{exp.hypothesis}</p>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={cn("text-[10px] font-medium", status.className)}>
            {status.label}
          </Badge>
          {exp.platform && exp.platform !== "general" && (
            <Badge variant="outline" className={cn("text-[10px] font-medium", platformColor)}>
              {platformLabel}
            </Badge>
          )}
          {exp.metric_primary && (
            <Badge variant="secondary" className="text-[10px]">{exp.metric_primary}</Badge>
          )}
          {decision && DecisionIcon && (
            <span className={cn("flex items-center gap-0.5 text-[10px] font-medium", decision.className)}>
              <DecisionIcon className="h-3 w-3" />{decision.label}
            </span>
          )}
        </div>

        {/* Baseline → Final + variación */}
        {exp.baseline_value != null && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            <span>Base: <span className="font-semibold text-foreground tabular-nums">{exp.baseline_value}</span></span>
            {exp.final_value != null && (
              <>
                <span className="text-muted-foreground/50">→</span>
                <span>Final: <span className="font-semibold text-foreground tabular-nums">{exp.final_value}</span></span>
                <VariationBadge pct={variationPct} />
              </>
            )}
          </div>
        )}

        {/* AI insight */}
        {exp.ai_insight && (
          <div className="flex gap-1.5 rounded-md bg-primary/5 border border-primary/10 px-2 py-1.5">
            <Sparkles className="h-3 w-3 shrink-0 text-primary mt-0.5" />
            <p className="text-[11px] text-foreground/80 leading-relaxed">{exp.ai_insight}</p>
          </div>
        )}

        {/* Result summary (solo si no hay ai_insight) */}
        {exp.result_summary && !exp.ai_insight && (
          <p className="text-[11px] text-muted-foreground line-clamp-2">{exp.result_summary}</p>
        )}

        {exp.changelog_title && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Link2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{exp.changelog_title}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(exp.created_at), { locale: es, addSuffix: true })}
          </span>
          <EditExperimentDialog exp={exp} onSuccess={onSuccess} />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Stats strip ───────────────────────────────────────────────────────────────

function StatsStrip({ data }: { data: Experiment[] }) {
  const done = data.filter((e) => e.status === "done");
  const withVariation = done.filter((e) => e.final_value != null && e.baseline_value != null);
  const scaled = done.filter((e) => e.decision === "scale").length;
  const avgVariation = withVariation.length > 0
    ? withVariation.reduce((s, e) => s + (computeVariation(e.baseline_value, e.final_value) ?? 0), 0) / withVariation.length
    : null;

  const stats = [
    { label: "Total", value: String(data.length), color: undefined },
    { label: "En curso", value: String(data.filter((e) => e.status === "running").length), color: "text-info" },
    { label: "Terminados", value: String(done.length), color: "text-success" },
    { label: "Escalados", value: String(scaled), color: scaled > 0 ? "text-success" : undefined },
    ...(avgVariation != null ? [{
      label: "Variación promedio",
      value: `${avgVariation >= 0 ? "+" : ""}${avgVariation.toFixed(1)}%`,
      color: avgVariation >= 0 ? "text-success" : "text-destructive",
    }] : []),
  ];

  return (
    <div className="flex gap-4 flex-wrap">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span className={cn("text-lg font-bold tabular-nums", s.color)}>{s.value}</span>
          <span className="text-xs text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const Experiments = () => {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useExperiments();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["experiments"] });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <SectionHeader badge="Experimentos" title="Experiments Board" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      </div>
    );
  }

  const byStatus = COLUMNS.reduce((acc, col) => {
    acc[col] = (data ?? []).filter((e) => e.status === col);
    return acc;
  }, {} as Record<ExperimentStatus, Experiment[]>);

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        badge="Experimentos"
        title="Experiments Board"
        subtitle={data?.length ? String(data.length) + " experimentos" : "0 experimentos"}
        action={
          currentWorkspace && user && (
            <NewExperimentDialog workspaceId={currentWorkspace.id} userId={user.id} onSuccess={invalidate} />
          )
        }
      />

      {(!data || data.length === 0) ? (
        <EmptyState
          title="Sin experimentos aún"
          description="¿Qué querés probar esta semana? Creá tu primera hipótesis con KPI y valor baseline."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colConfig = statusConfig[col];
            return (
              <div key={col} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {colConfig.col}
                  </h3>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                    {byStatus[col].length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {byStatus[col].length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center">
                      <p className="text-[11px] text-muted-foreground/60">Vacío</p>
                    </div>
                  ) : (
                    byStatus[col].map((exp) => (
                      <ExperimentCard key={exp.id} exp={exp} onSuccess={invalidate} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Experiments;
