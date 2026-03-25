import { useState } from "react";
import { useClient } from "@/contexts/ClientContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Send, RotateCcw, Zap, ChevronDown, ChevronUp, PauseCircle, TrendingUp, Flag, Users, SlidersHorizontal, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type AnalysisScope =
  | "free"
  | "campaign_review"
  | "strategic_insight"
  | "anomaly_detection"
  | "creative_analysis"
  | "budget_optimization";

const SCOPES: Array<{ value: AnalysisScope; label: string; emoji: string; description: string }> = [
  { value: "campaign_review", label: "Revisión de Campañas", emoji: "📊", description: "Performance detallada de las campañas activas" },
  { value: "strategic_insight", label: "Insight Estratégico", emoji: "🧠", description: "Análisis cruzado métricas + negocio" },
  { value: "anomaly_detection", label: "Detección de Anomalías", emoji: "🔍", description: "Cambios bruscos y tendencias inusuales" },
  { value: "creative_analysis", label: "Análisis Creativo", emoji: "🎨", description: "Ángulos creativos + buyer personas" },
  { value: "budget_optimization", label: "Optimización de Budget", emoji: "💰", description: "Redistribución por efficiency marginal" },
  { value: "free", label: "Pregunta Libre", emoji: "💬", description: "Cualquier pregunta con contexto completo" },
];

const SUGGESTED_QUESTIONS: Array<{ scope: AnalysisScope; question: string }> = [
  { scope: "campaign_review", question: "¿Cómo vienen las campañas este mes? ¿Cuáles están funcionando y cuáles no?" },
  { scope: "strategic_insight", question: "¿Qué oportunidades de escala ves basándote en los datos actuales?" },
  { scope: "anomaly_detection", question: "¿Hubo algo raro o cambios bruscos en los últimos días?" },
  { scope: "creative_analysis", question: "¿Qué ángulos creativos están funcionando mejor y qué nuevos probarías?" },
  { scope: "budget_optimization", question: "¿Cómo redistribuirías el presupuesto para maximizar resultados?" },
  { scope: "free", question: "Dame un diagnóstico general del estado de este cliente" },
];

type ActionType = "PAUSE_CAMPAIGN" | "SCALE_BUDGET" | "FLAG_CREATIVE" | "REVIEW_AUDIENCE" | "ADJUST_BID" | "ALERT";

interface SuggestedAction {
  type: ActionType;
  target_id?: string;
  target_name?: string;
  label: string;
  reason: string;
}

const ACTION_CONFIG: Record<ActionType, { icon: React.ElementType; className: string }> = {
  PAUSE_CAMPAIGN:  { icon: PauseCircle,       className: "border-destructive/30 text-destructive hover:bg-destructive/5" },
  SCALE_BUDGET:    { icon: TrendingUp,         className: "border-success/30 text-success hover:bg-success/5" },
  FLAG_CREATIVE:   { icon: Flag,               className: "border-warning/30 text-warning hover:bg-warning/5" },
  REVIEW_AUDIENCE: { icon: Users,              className: "border-info/30 text-info hover:bg-info/5" },
  ADJUST_BID:      { icon: SlidersHorizontal,  className: "border-primary/30 text-primary hover:bg-primary/5" },
  ALERT:           { icon: AlertTriangle,      className: "border-warning/30 text-warning hover:bg-warning/5" },
};

interface AnalysisResult {
  analysis: string;
  actions?: SuggestedAction[];
  context_summary: {
    client: string;
    has_marca: boolean;
    personas_count: number;
    competitors_count: number;
    products_count: number;
    campaigns_with_data: number;
    changelog_entries: number;
    date_range: { from: string; to: string };
  };
  model: string;
  tokens_used?: { input_tokens: number; output_tokens: number };
}

export default function AiAnalyst() {
  const { selectedClient } = useClient();
  const { currentWorkspace, dateRange } = useWorkspace();
  const [scope, setScope] = useState<AnalysisScope>("campaign_review");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);

  const handleAnalyze = async (customQuestion?: string) => {
    if (!selectedClient || !currentWorkspace) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "ai-analyst",
        {
          body: {
            clientId: selectedClient.id,
            workspaceId: currentWorkspace.id,
            scope,
            question: customQuestion || question || undefined,
            dateFrom: format(dateRange.from, "yyyy-MM-dd"),
            dateTo: format(dateRange.to, "yyyy-MM-dd"),
          },
        }
      );

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setResult(data as AnalysisResult);
    } catch (err: any) {
      setError(err.message || "Error al analizar");
    } finally {
      setLoading(false);
    }
  };

  if (!selectedClient) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Sparkles className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Seleccioná un cliente para usar el AI Analyst.
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedScope = SCOPES.find((s) => s.value === scope)!;

  return (
    <div className="space-y-4">
      {/* Scope Selector */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            onClick={() => {
              setScope(s.value);
              const suggested = SUGGESTED_QUESTIONS.find((q) => q.scope === s.value);
              if (suggested) setQuestion(suggested.question);
            }}
            className={cn(
              "text-left rounded-lg border p-3 transition-all hover:shadow-sm",
              scope === s.value
                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                : "border-border bg-card hover:bg-accent/30"
            )}
          >
            <span className="text-lg">{s.emoji}</span>
            <p className="text-[11px] font-semibold mt-1 leading-tight">{s.label}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{s.description}</p>
          </button>
        ))}
      </div>

      {/* Question Input */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{selectedScope.emoji}</span>
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {selectedScope.label}
            </span>
            <Badge variant="outline" className="text-[9px] ml-auto">
              {format(dateRange.from, "dd/MM")} → {format(dateRange.to, "dd/MM")}
            </Badge>
          </div>

          <Textarea
            placeholder="¿Qué querés saber? Dejalo vacío para un análisis general..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAnalyze();
            }}
          />

          <div className="flex items-center justify-between">
            <div className="flex gap-1.5 flex-wrap">
              {SUGGESTED_QUESTIONS.filter((q) => q.scope === scope).map((q, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-6 px-2"
                  onClick={() => {
                    setQuestion(q.question);
                    handleAnalyze(q.question);
                  }}
                >
                  <Zap className="h-2.5 w-2.5 mr-1" />
                  Sugerida
                </Button>
              ))}
            </div>
            <Button
              onClick={() => handleAnalyze()}
              disabled={loading}
              size="sm"
              className="gap-1.5"
            >
              {loading ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Analizar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card className="border-primary/20">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-xs font-medium text-primary">Claude está analizando los datos de {selectedClient.name}...</span>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[75%]" />
            <Skeleton className="h-4 w-[85%]" />
            <Skeleton className="h-4 w-[60%]" />
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-xs text-destructive font-medium">Error: {error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 text-xs"
              onClick={() => handleAnalyze()}
            >
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className="border-primary/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-bold">Análisis de {result.context_summary.client}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px]">
                  {result.model.replace("claude-", "").replace("-20250514", "")}
                </Badge>
                {result.tokens_used && (
                  <Badge variant="outline" className="text-[9px] text-muted-foreground">
                    {(result.tokens_used.input_tokens + result.tokens_used.output_tokens).toLocaleString()} tokens
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Analysis body */}
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
              {result.analysis}
            </div>

            {/* Action buttons */}
            {result.actions && result.actions.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Acciones sugeridas</p>
                <div className="flex flex-wrap gap-2">
                  {result.actions.map((action, i) => {
                    const config = ACTION_CONFIG[action.type] ?? ACTION_CONFIG.ALERT;
                    const ActionIcon = config.icon;
                    return (
                      <Tooltip key={i}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn("text-xs h-8 gap-1.5 font-medium", config.className)}
                          >
                            <ActionIcon className="h-3.5 w-3.5" />
                            {action.label}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          {action.reason}
                          {action.target_name && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Target: {action.target_name}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Context summary (collapsible) */}
            <button
              onClick={() => setShowContext(!showContext)}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showContext ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Contexto utilizado
            </button>

            {showContext && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-muted/30 rounded-lg p-3">
                <ContextChip label="Marca" value={result.context_summary.has_marca ? "✓" : "✗"} positive={result.context_summary.has_marca} />
                <ContextChip label="Personas" value={String(result.context_summary.personas_count)} positive={result.context_summary.personas_count > 0} />
                <ContextChip label="Competidores" value={String(result.context_summary.competitors_count)} positive={result.context_summary.competitors_count > 0} />
                <ContextChip label="Productos" value={String(result.context_summary.products_count)} positive={result.context_summary.products_count > 0} />
                <ContextChip label="Campañas c/datos" value={String(result.context_summary.campaigns_with_data)} positive={result.context_summary.campaigns_with_data > 0} />
                <ContextChip label="Cambios recientes" value={String(result.context_summary.changelog_entries)} positive={result.context_summary.changelog_entries > 0} />
                <ContextChip label="Desde" value={result.context_summary.date_range.from} positive />
                <ContextChip label="Hasta" value={result.context_summary.date_range.to} positive />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ContextChip({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={cn("text-[10px] font-bold", positive ? "text-success" : "text-muted-foreground/50")}>
        {value}
      </span>
    </div>
  );
}
