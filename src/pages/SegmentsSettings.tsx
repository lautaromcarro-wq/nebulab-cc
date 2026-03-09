import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, RefreshCw, AlertTriangle, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Segment = Tables<"segments">;
type SegmentRule = Tables<"segment_rules">;

interface CampaignMapping {
  id: string;
  campaign_id: string;
  segment_id: string | null;
  match_status: string;
  matched_rules: unknown;
  campaigns: { name: string; provider: string; external_id: string } | null;
}

// Group rules by group_id for display
interface RuleGroup {
  group_id: string;
  rules: SegmentRule[];
}

function groupRules(rules: SegmentRule[]): RuleGroup[] {
  const map = new Map<string, SegmentRule[]>();
  for (const r of rules) {
    const arr = map.get(r.group_id) ?? [];
    arr.push(r);
    map.set(r.group_id, arr);
  }
  return Array.from(map.entries()).map(([group_id, rules]) => ({ group_id, rules }));
}

const SegmentsSettings = () => {
  const { currentWorkspace, workspaceRole } = useWorkspace();
  const { clients } = useClient();
  const isAdmin = workspaceRole === "admin";

  const [segments, setSegments] = useState<Segment[]>([]);
  const [rules, setRules] = useState<SegmentRule[]>([]);
  const [mappings, setMappings] = useState<CampaignMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [recomputingDaily, setRecomputingDaily] = useState(false);

  // Form states
  const [segDialogOpen, setSegDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [segForm, setSegForm] = useState({
    name: "",
    currency: "USD",
    monthly_budget: "0",
    tolerance_percent: "0.07",
    rolling_avg_days: "3",
    client_id: "none",
  });

  // Rule group creation
  const [ruleGroupDialogOpen, setRuleGroupDialogOpen] = useState(false);
  const [ruleGroupSegmentId, setRuleGroupSegmentId] = useState<string | null>(null);
  const [ruleGroupConditions, setRuleGroupConditions] = useState<Array<{
    platform: "meta" | "google_ads" | "any";
    rule_type: "contains" | "starts_with" | "regex" | "in_list";
    rule_value: string;
  }>>([{ platform: "any", rule_type: "contains", rule_value: "" }]);

  const wsId = currentWorkspace?.id;

  const fetchAll = useCallback(async () => {
    if (!wsId) return;
    setLoading(true);

    const [segRes, ruleRes, mapRes] = await Promise.all([
      supabase.from("segments").select("*").eq("workspace_id", wsId).order("name"),
      supabase.from("segment_rules").select("*").eq("workspace_id", wsId).order("priority"),
      supabase
        .from("campaign_segment_map")
        .select("id, campaign_id, segment_id, match_status, matched_rules, campaigns(name, provider, external_id)")
        .eq("workspace_id", wsId)
        .order("match_status"),
    ]);

    setSegments(segRes.data ?? []);
    setRules(ruleRes.data ?? []);
    setMappings((mapRes.data as unknown as CampaignMapping[]) ?? []);
    setLoading(false);
  }, [wsId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Segment CRUD
  const openCreateSegment = () => {
    setEditingSegment(null);
    setSegForm({ name: "", currency: "USD", monthly_budget: "0", tolerance_percent: "0.07", rolling_avg_days: "3", client_id: "none" });
    setSegDialogOpen(true);
  };

  const openEditSegment = (s: Segment) => {
    setEditingSegment(s);
    setSegForm({
      name: s.name,
      currency: s.currency,
      monthly_budget: String(s.monthly_budget),
      tolerance_percent: String(s.tolerance_percent),
      rolling_avg_days: String(s.rolling_avg_days),
      client_id: s.client_id ?? "none",
    });
    setSegDialogOpen(true);
  };

  const saveSegment = async () => {
    if (!wsId) return;
    const payload = {
      workspace_id: wsId,
      name: segForm.name,
      currency: segForm.currency,
      monthly_budget: Number(segForm.monthly_budget),
      tolerance_percent: Number(segForm.tolerance_percent),
      rolling_avg_days: Number(segForm.rolling_avg_days),
      client_id: segForm.client_id === "none" ? null : segForm.client_id,
    };

    if (editingSegment) {
      const { error } = await supabase.from("segments").update(payload).eq("id", editingSegment.id);
      if (error) return toast.error(error.message);
      toast.success("Segment actualizado");
    } else {
      const { error } = await supabase.from("segments").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Segment creado");
    }
    setSegDialogOpen(false);
    fetchAll();
  };

  const deleteSegment = async (id: string) => {
    const { error } = await supabase.from("segments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Segment eliminado");
    fetchAll();
  };

  // Rule Group CRUD
  const openCreateRuleGroup = (segId: string) => {
    setRuleGroupSegmentId(segId);
    setRuleGroupConditions([{ platform: "any", rule_type: "contains", rule_value: "" }]);
    setRuleGroupDialogOpen(true);
  };

  const addCondition = () => {
    setRuleGroupConditions([...ruleGroupConditions, { platform: "any", rule_type: "contains", rule_value: "" }]);
  };

  const removeCondition = (idx: number) => {
    setRuleGroupConditions(ruleGroupConditions.filter((_, i) => i !== idx));
  };

  const updateCondition = (idx: number, field: string, value: string) => {
    setRuleGroupConditions(ruleGroupConditions.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const saveRuleGroup = async () => {
    if (!wsId || !ruleGroupSegmentId) return;
    const validConditions = ruleGroupConditions.filter((c) => c.rule_value.trim());
    if (validConditions.length === 0) return toast.error("Agregá al menos una condición");

    // Generate a shared group_id for all conditions (AND logic)
    const groupId = crypto.randomUUID();

    const rows = validConditions.map((c, i) => ({
      workspace_id: wsId,
      segment_id: ruleGroupSegmentId,
      platform: c.platform,
      rule_type: c.rule_type,
      rule_value: c.rule_value.trim(),
      priority: 100 + i,
      group_id: groupId,
    }));

    const { error } = await supabase.from("segment_rules").insert(rows);
    if (error) return toast.error(error.message);

    const condCount = validConditions.length;
    toast.success(`Grupo de ${condCount} condición(es) creado — recomputando mapping…`);
    setRuleGroupDialogOpen(false);

    // Auto-recompute
    try {
      const { data } = await supabase.functions.invoke("compute-campaign-segment-map", {
        body: { workspace_id: wsId },
      });
      toast.success(`Mapping actualizado: ${data?.processed ?? 0} campañas, ${data?.unassigned ?? 0} sin asignar`);
    } catch {
      toast.error("No se pudo recomputar el mapping automáticamente");
    }
    fetchAll();
  };

  const deleteRuleGroup = async (groupId: string) => {
    const { error } = await supabase.from("segment_rules").delete().eq("group_id", groupId);
    if (error) return toast.error(error.message);
    toast.success("Grupo de reglas eliminado — recomputando mapping…");

    try {
      await supabase.functions.invoke("compute-campaign-segment-map", {
        body: { workspace_id: wsId },
      });
    } catch { /* silent */ }
    fetchAll();
  };

  // Recompute mapping
  const recompute = async () => {
    setRecomputing(true);
    try {
      const { error } = await supabase.functions.invoke("compute-campaign-segment-map", {
        body: { workspace_id: wsId },
      });
      if (error) throw error;
      toast.success("Mapping recomputado");
      fetchAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al recomputar");
    }
    setRecomputing(false);
  };

  const recomputeSegmentDaily = async () => {
    setRecomputingDaily(true);
    try {
      toast.info("Paso 1/2: Recomputando mapping…");
      await supabase.functions.invoke("compute-campaign-segment-map", {
        body: { workspace_id: wsId },
      });

      toast.info("Paso 2/2: Agregando métricas por segmento…");
      const { data, error } = await supabase.functions.invoke("compute-segment-daily", {
        body: { workspace_id: wsId, days_back: 30 },
      });
      if (error) throw error;
      toast.success(`Segments recomputados: ${data?.upserted ?? 0} filas, ${data?.conflicts ?? 0} conflictos`);
      fetchAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al recomputar segments");
    }
    setRecomputingDaily(false);
  };

  const conflicts = mappings.filter((m) => m.match_status === "conflict");
  const unassigned = mappings.filter((m) => m.match_status === "unassigned");
  const assigned = mappings.filter((m) => m.match_status === "assigned");

  if (loading) {
    return <div className="animate-pulse text-muted-foreground p-8">Cargando…</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Segments</h1>
          <p className="text-muted-foreground text-sm">
            Configurá segmentos multi-marca y reglas de clasificación por campaign naming.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={recomputeSegmentDaily} disabled={recomputingDaily}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${recomputingDaily ? "animate-spin" : ""}`} />
                Recompute Segments (30d)
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Primero recalcula el mapping (qué campañas pertenecen a qué segmento según las reglas) y luego agrega las métricas en segment_daily (spend, clicks, etc.) por segmento y día.
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={recompute} disabled={recomputing}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${recomputing ? "animate-spin" : ""}`} />
                Recompute mapping
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Solo recalcula campaign_segment_map: clasifica cada campaña según las reglas y muestra assigned/unassigned/conflict. No afecta métricas.
            </TooltipContent>
          </Tooltip>
          {isAdmin && (
            <Dialog open={segDialogOpen} onOpenChange={setSegDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openCreateSegment}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Nuevo Segment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingSegment ? "Editar" : "Crear"} Segment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>Cliente / Marca</Label>
                    <Select value={segForm.client_id} onValueChange={(v) => setSegForm({ ...segForm, client_id: v })}>
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin cliente (workspace global)</SelectItem>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nombre</Label>
                    <Input value={segForm.name} onChange={(e) => setSegForm({ ...segForm, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Moneda</Label>
                      <Input value={segForm.currency} onChange={(e) => setSegForm({ ...segForm, currency: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Budget mensual</Label>
                      <Input type="number" value={segForm.monthly_budget} onChange={(e) => setSegForm({ ...segForm, monthly_budget: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Tolerancia (%)</Label>
                      <Input type="number" step="0.01" value={segForm.tolerance_percent} onChange={(e) => setSegForm({ ...segForm, tolerance_percent: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Rolling avg (días)</Label>
                      <Input type="number" value={segForm.rolling_avg_days} onChange={(e) => setSegForm({ ...segForm, rolling_avg_days: e.target.value })} />
                    </div>
                  </div>
                  <Button onClick={saveSegment} className="w-full">Guardar</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Segments list with rule groups */}
      {segments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground text-sm">
            No hay Segments. Creá uno para empezar a clasificar campañas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Group by client */}
          {[...clients, null].map((client) => {
            const clientSegments = client
              ? segments.filter((s) => s.client_id === client.id)
              : segments.filter((s) => !s.client_id);
            if (clientSegments.length === 0) return null;
            return (
              <div key={client?.id ?? "global"} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {client ? client.name : "Global (sin cliente)"}
                  </span>
                  <div className="flex-1 border-t border-border/50" />
                  <Badge variant="outline" className="text-[10px]">{clientSegments.length}</Badge>
                </div>
                <div className="space-y-4">
          {clientSegments.map((seg) => {
            const segRules = rules.filter((r) => r.segment_id === seg.id);
            const ruleGroups = groupRules(segRules);
            const segCampaigns = assigned.filter((m) => m.segment_id === seg.id).slice(0, 20);

            return (
              <Card key={seg.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{seg.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {seg.currency} · Budget: {Number(seg.monthly_budget).toLocaleString()} · Tolerancia: {(Number(seg.tolerance_percent) * 100).toFixed(0)}% · Avg: {seg.rolling_avg_days}d
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1.5">
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => openEditSegment(seg)}>Editar</Button>
                        <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => deleteSegment(seg.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Rule Groups */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reglas</span>
                      {isAdmin && (
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => openCreateRuleGroup(seg.id)}>
                          <Plus className="h-3 w-3 mr-1" /> Agregar grupo de reglas
                        </Button>
                      )}
                    </div>
                    {ruleGroups.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin reglas configuradas.</p>
                    ) : (
                      <div className="space-y-2">
                        {ruleGroups.map((group) => (
                          <div key={group.group_id} className="flex items-center gap-1.5 flex-wrap p-2 rounded-md bg-muted/30 border border-border/50">
                            {group.rules.map((r, idx) => (
                              <span key={r.id} className="contents">
                                {idx > 0 && <Badge variant="outline" className="text-[9px] font-bold bg-primary/10 text-primary border-primary/20">AND</Badge>}
                                <Badge variant="secondary" className="text-[10px] font-mono">
                                  {r.platform !== "any" && <span className="opacity-60">{r.platform}:</span>}
                                  {r.rule_type}("{r.rule_value}")
                                </Badge>
                              </span>
                            ))}
                            {isAdmin && (
                              <button
                                onClick={() => deleteRuleGroup(group.group_id)}
                                className="ml-auto text-muted-foreground/50 hover:text-destructive transition-colors"
                                title="Eliminar grupo"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                        {ruleGroups.length > 1 && (
                          <p className="text-[10px] text-muted-foreground/60 italic">Los grupos se evalúan como OR entre sí</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Matching campaigns preview */}
                  {segCampaigns.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Campañas asignadas ({segCampaigns.length}{assigned.filter((m) => m.segment_id === seg.id).length > 20 ? "+" : ""})
                      </span>
                      <div className="mt-1.5 space-y-0.5">
                        {segCampaigns.map((m) => (
                          <div key={m.id} className="flex items-center gap-2 text-xs py-0.5">
                            <Badge variant="outline" className="text-[9px] shrink-0">
                              {m.campaigns?.provider ?? "—"}
                            </Badge>
                            <span className="truncate">{m.campaigns?.name ?? m.campaign_id}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Conflicts ({conflicts.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">Campañas que matchean más de un Segment. No se suman a segment_daily.</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Campaign</TableHead>
                  <TableHead className="text-xs">Platform</TableHead>
                  <TableHead className="text-xs">Matched Rules</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conflicts.slice(0, 50).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{m.campaigns?.name ?? m.campaign_id}</TableCell>
                    <TableCell className="text-xs">{m.campaigns?.provider ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono opacity-70">
                      {JSON.stringify(m.matched_rules)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Unassigned */}
      {unassigned.length > 0 && (
        <Card className="border-warning/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-warning">
              <HelpCircle className="h-4 w-4" />
              Unassigned ({unassigned.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">Campañas sin match. Creá reglas para clasificarlas.</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Campaign</TableHead>
                  <TableHead className="text-xs">Platform</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassigned.slice(0, 50).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{m.campaigns?.name ?? m.campaign_id}</TableCell>
                    <TableCell className="text-xs">{m.campaigns?.provider ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Rule Group creation dialog */}
      <Dialog open={ruleGroupDialogOpen} onOpenChange={setRuleGroupDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo grupo de reglas</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Todas las condiciones de un grupo deben cumplirse simultáneamente (AND). 
            Para lógica OR, creá grupos separados.
          </p>
          <div className="space-y-3 pt-2 max-h-[50vh] overflow-y-auto">
            {ruleGroupConditions.map((cond, idx) => (
              <div key={idx} className="space-y-2 p-3 rounded-md bg-muted/30 border border-border/50 relative">
                {idx > 0 && (
                  <Badge variant="outline" className="absolute -top-2.5 left-3 text-[9px] font-bold bg-primary/10 text-primary border-primary/20">
                    AND
                  </Badge>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-medium">Condición {idx + 1}</span>
                  {ruleGroupConditions.length > 1 && (
                    <button onClick={() => removeCondition(idx)} className="text-muted-foreground/50 hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={cond.platform} onValueChange={(v) => updateCondition(idx, "platform", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Cualquiera</SelectItem>
                      <SelectItem value="meta">Meta</SelectItem>
                      <SelectItem value="google_ads">Google Ads</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={cond.rule_type} onValueChange={(v) => updateCondition(idx, "rule_type", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="starts_with">Starts with</SelectItem>
                      <SelectItem value="regex">Regex</SelectItem>
                      <SelectItem value="in_list">In list</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  className="h-8 text-xs"
                  value={cond.rule_value}
                  onChange={(e) => updateCondition(idx, "rule_value", e.target.value)}
                  placeholder={cond.rule_type === "in_list" ? "valor1,valor2" : "texto a buscar"}
                />
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={addCondition}>
            <Plus className="h-3 w-3 mr-1.5" /> Agregar condición AND
          </Button>
          <Button onClick={saveRuleGroup} className="w-full">Guardar grupo</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SegmentsSettings;
