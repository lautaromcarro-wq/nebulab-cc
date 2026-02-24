import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
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

const SegmentsSettings = () => {
  const { currentWorkspace, workspaceRole } = useWorkspace();
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
  });

  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleSegmentId, setRuleSegmentId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState({
    platform: "any" as "meta" | "google_ads" | "any",
    rule_type: "contains" as "contains" | "starts_with" | "regex" | "in_list",
    rule_value: "",
    priority: "100",
  });

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
    setSegForm({ name: "", currency: "USD", monthly_budget: "0", tolerance_percent: "0.07", rolling_avg_days: "3" });
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

  // Rule CRUD
  const openCreateRule = (segId: string) => {
    setRuleSegmentId(segId);
    setRuleForm({ platform: "any", rule_type: "contains", rule_value: "", priority: "100" });
    setRuleDialogOpen(true);
  };

  const saveRule = async () => {
    if (!wsId || !ruleSegmentId) return;
    const { error } = await supabase.from("segment_rules").insert({
      workspace_id: wsId,
      segment_id: ruleSegmentId,
      platform: ruleForm.platform,
      rule_type: ruleForm.rule_type,
      rule_value: ruleForm.rule_value,
      priority: Number(ruleForm.priority),
    });
    if (error) return toast.error(error.message);
    toast.success("Regla creada");
    setRuleDialogOpen(false);
    fetchAll();
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase.from("segment_rules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Regla eliminada");
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={recomputeSegmentDaily} disabled={recomputingDaily}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${recomputingDaily ? "animate-spin" : ""}`} />
            Recompute Segments (30d)
          </Button>
          <Button variant="outline" size="sm" onClick={recompute} disabled={recomputing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${recomputing ? "animate-spin" : ""}`} />
            Recompute mapping
          </Button>
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

      {/* Segments list with rules */}
      {segments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground text-sm">
            No hay Segments. Creá uno para empezar a clasificar campañas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {segments.map((seg) => {
            const segRules = rules.filter((r) => r.segment_id === seg.id);
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
                  {/* Rules */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reglas</span>
                      {isAdmin && (
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => openCreateRule(seg.id)}>
                          <Plus className="h-3 w-3 mr-1" /> Agregar regla
                        </Button>
                      )}
                    </div>
                    {segRules.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin reglas configuradas.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {segRules.map((r) => (
                          <Badge key={r.id} variant="secondary" className="gap-1 text-[10px] font-mono">
                            {r.platform !== "any" && <span className="opacity-60">{r.platform}:</span>}
                            {r.rule_type}("{r.rule_value}")
                            {isAdmin && (
                              <button onClick={() => deleteRule(r.id)} className="ml-1 opacity-50 hover:opacity-100">×</button>
                            )}
                          </Badge>
                        ))}
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

      {/* Rule creation dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva regla</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plataforma</Label>
                <Select value={ruleForm.platform} onValueChange={(v) => setRuleForm({ ...ruleForm, platform: v as "meta" | "google_ads" | "any" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Cualquiera</SelectItem>
                    <SelectItem value="meta">Meta</SelectItem>
                    <SelectItem value="google_ads">Google Ads</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de regla</Label>
                <Select value={ruleForm.rule_type} onValueChange={(v) => setRuleForm({ ...ruleForm, rule_type: v as "contains" | "starts_with" | "regex" | "in_list" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="starts_with">Starts with</SelectItem>
                    <SelectItem value="regex">Regex</SelectItem>
                    <SelectItem value="in_list">In list</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <Input
                value={ruleForm.rule_value}
                onChange={(e) => setRuleForm({ ...ruleForm, rule_value: e.target.value })}
                placeholder={ruleForm.rule_type === "in_list" ? "valor1,valor2,valor3" : "texto a buscar"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Input type="number" value={ruleForm.priority} onChange={(e) => setRuleForm({ ...ruleForm, priority: e.target.value })} />
            </div>
            <Button onClick={saveRule} className="w-full">Guardar regla</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SegmentsSettings;
