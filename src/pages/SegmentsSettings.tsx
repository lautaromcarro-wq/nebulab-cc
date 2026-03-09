import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus, Trash2, RefreshCw, AlertTriangle, HelpCircle,
  Wand2, CheckCircle2, XCircle, ChevronRight, Layers,
  Search, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import SectionHeader from "@/components/SectionHeader";
import type { Tables } from "@/integrations/supabase/types";

type Segment = Tables<"segments">;
type SegmentRule = Tables<"segment_rules">;

interface Campaign {
  id: string;
  name: string;
  provider: string;
  external_id: string;
}

interface CampaignMapping {
  id: string;
  campaign_id: string;
  segment_id: string | null;
  match_status: string;
  campaigns: Campaign | null;
}

interface RuleGroup { group_id: string; rules: SegmentRule[] }

function groupRules(rules: SegmentRule[]): RuleGroup[] {
  const map = new Map<string, SegmentRule[]>();
  for (const r of rules) {
    const arr = map.get(r.group_id) ?? [];
    arr.push(r);
    map.set(r.group_id, arr);
  }
  return Array.from(map.entries()).map(([group_id, rules]) => ({ group_id, rules }));
}

// ── Auto-pattern suggester ─────────────────────────────────────────────
function suggestPattern(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) {
    // Take first meaningful token
    const tokens = names[0].split(/[\s_\-|]+/).filter((t) => t.length >= 2);
    return tokens[0] ?? names[0].slice(0, 8);
  }
  // Find longest common substring across all names (case-insensitive)
  const lower = names.map((n) => n.toLowerCase());
  const first = lower[0];
  let best = "";
  for (let len = 2; len <= first.length; len++) {
    for (let start = 0; start <= first.length - len; start++) {
      const sub = first.slice(start, start + len);
      if (lower.every((n) => n.includes(sub))) {
        if (sub.length > best.length) best = sub;
      }
    }
  }
  // If we found a common substring, clean it up
  if (best.length >= 2) return best.replace(/^[\s_\-]+|[\s_\-]+$/g, "");
  // Fallback: first token of first name
  const tokens = names[0].split(/[\s_\-|]+/).filter((t) => t.length >= 2);
  return tokens[0] ?? names[0].slice(0, 8);
}

// ── Rule matcher (mirrors backend logic) ──────────────────────────────
function matchesRule(campaignName: string, ruleType: string, ruleValue: string): boolean {
  const name = campaignName.toLowerCase();
  const val = ruleValue.toLowerCase().trim();
  if (!val) return false;
  switch (ruleType) {
    case "contains": return name.includes(val);
    case "starts_with": return name.startsWith(val);
    case "regex": try { return new RegExp(ruleValue, "i").test(campaignName); } catch { return false; }
    case "in_list": return val.split(",").map((v) => v.trim()).some((v) => name.includes(v));
    default: return false;
  }
}

// ── Live Preview ───────────────────────────────────────────────────────
function LivePreview({
  campaigns, ruleType, ruleValue, platform,
}: {
  campaigns: Campaign[]; ruleType: string; ruleValue: string; platform: string;
}) {
  const filtered = useMemo(() => {
    if (!ruleValue.trim()) return { matches: [], nonMatches: campaigns.slice(0, 5) };
    const relevant = platform === "any" ? campaigns : campaigns.filter((c) => c.provider === platform);
    const matches = relevant.filter((c) => matchesRule(c.name, ruleType, ruleValue));
    const nonMatches = relevant.filter((c) => !matchesRule(c.name, ruleType, ruleValue)).slice(0, 4);
    return { matches, nonMatches };
  }, [campaigns, ruleType, ruleValue, platform]);

  if (!ruleValue.trim()) return (
    <p className="text-[11px] text-muted-foreground italic">
      Escribí un valor para ver qué campañas matchearían
    </p>
  );

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        Preview en tiempo real
      </p>
      <div className="space-y-0.5 max-h-40 overflow-y-auto">
        {filtered.matches.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic">
            Ninguna campaña matchea esta regla
          </p>
        )}
        {filtered.matches.map((c) => (
          <div key={c.id} className="flex items-center gap-1.5 text-[11px]">
            <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
            <span className="font-medium truncate">{c.name}</span>
            <Badge variant="outline" className="text-[9px] shrink-0">{c.provider}</Badge>
          </div>
        ))}
        {filtered.nonMatches.map((c) => (
          <div key={c.id} className="flex items-center gap-1.5 text-[11px] opacity-40">
            <XCircle className="h-3 w-3 shrink-0" />
            <span className="truncate">{c.name}</span>
          </div>
        ))}
        {filtered.matches.length > 0 && filtered.nonMatches.length === 0 && (
          <p className="text-[10px] text-muted-foreground">…y más</p>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        <strong className="text-success">{filtered.matches.length}</strong> matchean ·{" "}
        <strong>{(platform === "any" ? campaigns : campaigns.filter((c) => c.provider === platform)).length - filtered.matches.length}</strong> no matchean
      </p>
    </div>
  );
}

// ── Create Segment from Campaigns dialog ──────────────────────────────
function CreateFromCampaignsDialog({
  open, onClose, selectedCampaigns, wsId, clients, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  selectedCampaigns: Campaign[];
  wsId: string;
  clients: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const suggested = useMemo(
    () => suggestPattern(selectedCampaigns.map((c) => c.name)),
    [selectedCampaigns],
  );

  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [clientId, setClientId] = useState("none");
  const [ruleValue, setRuleValue] = useState(suggested);
  const [ruleType, setRuleType] = useState("contains");
  const [platform, setPlatform] = useState("any");
  const [saving, setSaving] = useState(false);

  // Sync suggestion when dialog opens
  useEffect(() => {
    if (open) setRuleValue(suggested);
  }, [open, suggested]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nombre requerido"); return; }
    if (!ruleValue.trim()) { toast.error("Regla requerida"); return; }
    setSaving(true);

    // 1. Create segment
    const { data: seg, error: segErr } = await supabase
      .from("segments")
      .insert({
        workspace_id: wsId,
        name: name.trim(),
        currency,
        monthly_budget: Number(budget) || 0,
        tolerance_percent: 0.07,
        rolling_avg_days: 3,
        client_id: clientId === "none" ? null : clientId,
      })
      .select("id")
      .single();

    if (segErr || !seg) { toast.error("Error al crear segmento"); setSaving(false); return; }

    // 2. Create rule group
    const groupId = crypto.randomUUID();
    const { error: ruleErr } = await supabase.from("segment_rules").insert({
      workspace_id: wsId,
      segment_id: seg.id,
      platform,
      rule_type: ruleType,
      rule_value: ruleValue.trim(),
      priority: 100,
      group_id: groupId,
    });

    if (ruleErr) { toast.error("Error al crear regla"); setSaving(false); return; }

    // 3. Recompute
    try {
      await supabase.functions.invoke("compute-campaign-segment-map", { body: { workspace_id: wsId } });
      toast.success(`Segmento "${name}" creado y mapping actualizado`);
    } catch {
      toast.success(`Segmento "${name}" creado — recomputá el mapping manualmente`);
    }

    setSaving(false);
    onCreated();
    onClose();
  };

  const allCampaigns = selectedCampaigns;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            Crear segmento desde {selectedCampaigns.length} campaña{selectedCampaigns.length !== 1 ? "s" : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 py-2">
          {/* Left: config */}
          <div className="space-y-4">
            <div>
              <Label className="text-xs mb-1.5 block">Nombre del segmento</Label>
              <Input
                placeholder="Ej: Prospecting, Retargeting, Brand…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs mb-1.5 block">Budget mensual</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Moneda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["USD", "ARS", "MXN", "BRL", "EUR"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cliente</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Regla de clasificación</Label>
                <button
                  className="text-[10px] text-primary flex items-center gap-1 hover:underline"
                  onClick={() => setRuleValue(suggested)}
                >
                  <Wand2 className="h-3 w-3" /> Auto-sugerir
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={ruleType} onValueChange={setRuleType}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contiene</SelectItem>
                    <SelectItem value="starts_with">Empieza con</SelectItem>
                    <SelectItem value="regex">Regex</SelectItem>
                    <SelectItem value="in_list">Lista (a,b,c)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Cualquier plataforma</SelectItem>
                    <SelectItem value="meta">Meta</SelectItem>
                    <SelectItem value="google_ads">Google Ads</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input
                value={ruleValue}
                onChange={(e) => setRuleValue(e.target.value)}
                placeholder="Patrón a buscar en el nombre de la campaña"
                className="text-sm font-mono"
              />
            </div>
          </div>

          {/* Right: live preview */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Campañas seleccionadas
            </p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {selectedCampaigns.map((c) => (
                <div key={c.id} className="flex items-center gap-1.5 text-[11px]">
                  <Badge variant="outline" className="text-[9px] shrink-0">{c.provider}</Badge>
                  <span className="truncate font-medium">{c.name}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3">
              <LivePreview
                campaigns={allCampaigns}
                ruleType={ruleType}
                ruleValue={ruleValue}
                platform={platform}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {saving ? "Creando…" : "Crear segmento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Quick-assign dialog ────────────────────────────────────────────────
function QuickAssignDialog({
  campaign, segments, wsId, onAssigned,
}: {
  campaign: Campaign; segments: Segment[]; wsId: string; onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [segId, setSegId] = useState("");
  const [ruleType, setRuleType] = useState("contains");
  const [ruleValue, setRuleValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // Auto-suggest a pattern from the campaign name
      const tokens = campaign.name.split(/[\s_\-|]+/).filter((t) => t.length >= 3);
      setRuleValue(tokens[0] ?? campaign.name.slice(0, 10));
    }
  }, [open, campaign.name]);

  const handleSave = async () => {
    if (!segId) { toast.error("Seleccioná un segmento"); return; }
    if (!ruleValue.trim()) { toast.error("Ingresá un patrón"); return; }
    setSaving(true);

    const groupId = crypto.randomUUID();
    const { error } = await supabase.from("segment_rules").insert({
      workspace_id: wsId,
      segment_id: segId,
      platform: campaign.provider === "meta" ? "meta" : campaign.provider === "google_ads" ? "google_ads" : "any",
      rule_type: ruleType,
      rule_value: ruleValue.trim(),
      priority: 100,
      group_id: groupId,
    });

    if (error) { toast.error("Error al crear regla"); setSaving(false); return; }

    try {
      await supabase.functions.invoke("compute-campaign-segment-map", { body: { workspace_id: wsId } });
    } catch { /* silent */ }

    toast.success("Regla creada y mapping actualizado");
    setSaving(false);
    setOpen(false);
    onAssigned();
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-6 text-[10px] gap-1 px-2 shrink-0"
        onClick={() => setOpen(true)}
      >
        <ChevronRight className="h-3 w-3" />
        Asignar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Asignar campaña a segmento</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 pb-2">
            <p className="text-xs text-muted-foreground">Campaña:</p>
            <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
              <Badge variant="outline" className="text-[9px]">{campaign.provider}</Badge>
              <p className="text-xs font-medium font-mono">{campaign.name}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1.5 block">Segmento destino</Label>
              <Select value={segId} onValueChange={setSegId}>
                <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Elegir segmento…" /></SelectTrigger>
                <SelectContent>
                  {segments.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs mb-1.5 block">Tipo de regla</Label>
                <Select value={ruleType} onValueChange={setRuleType}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contiene</SelectItem>
                    <SelectItem value="starts_with">Empieza con</SelectItem>
                    <SelectItem value="regex">Regex</SelectItem>
                    <SelectItem value="in_list">Lista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Patrón</Label>
                <Input
                  value={ruleValue}
                  onChange={(e) => setRuleValue(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <LivePreview
                campaigns={[campaign]}
                ruleType={ruleType}
                ruleValue={ruleValue}
                platform="any"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : "Guardar regla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main ───────────────────────────────────────────────────────────────
const SegmentsSettings = () => {
  const { currentWorkspace, workspaceRole } = useWorkspace();
  const { clients } = useClient();
  const isAdmin = workspaceRole === "admin";
  const wsId = currentWorkspace?.id ?? "";

  const [segments, setSegments] = useState<Segment[]>([]);
  const [rules, setRules] = useState<SegmentRule[]>([]);
  const [mappings, setMappings] = useState<CampaignMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  // Campaign selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Segment form
  const [segDialogOpen, setSegDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [segForm, setSegForm] = useState({
    name: "", currency: "USD", monthly_budget: "0",
    tolerance_percent: "0.07", rolling_avg_days: "3", client_id: "none",
  });

  // Rule group dialog
  const [ruleGroupDialogOpen, setRuleGroupDialogOpen] = useState(false);
  const [ruleGroupSegmentId, setRuleGroupSegmentId] = useState<string | null>(null);
  const [ruleGroupConditions, setRuleGroupConditions] = useState<Array<{
    platform: string; rule_type: string; rule_value: string;
  }>>([{ platform: "any", rule_type: "contains", rule_value: "" }]);

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

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const unassigned = mappings.filter((m) => m.match_status === "unassigned");
  const assigned = mappings.filter((m) => m.match_status === "assigned");
  const conflicts = mappings.filter((m) => m.match_status === "conflict");
  const allCampaigns: Campaign[] = mappings
    .filter((m) => m.campaigns)
    .map((m) => m.campaigns!);

  const filteredUnassigned = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return unassigned.filter((m) =>
      !term || m.campaigns?.name.toLowerCase().includes(term) || m.campaigns?.provider.includes(term),
    );
  }, [unassigned, searchTerm]);

  const selectedCampaigns = useMemo(
    () => allCampaigns.filter((c) => selectedIds.has(c.id)),
    [allCampaigns, selectedIds],
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredUnassigned.map((m) => m.campaigns!.id).filter(Boolean)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const recompute = async () => {
    setRecomputing(true);
    try {
      await supabase.functions.invoke("compute-campaign-segment-map", { body: { workspace_id: wsId } });
      toast.success("Mapping actualizado");
      fetchAll();
    } catch { toast.error("Error al recomputar"); }
    setRecomputing(false);
  };

  // Segment CRUD
  const openEditSegment = (s: Segment) => {
    setEditingSegment(s);
    setSegForm({
      name: s.name, currency: s.currency,
      monthly_budget: String(s.monthly_budget),
      tolerance_percent: String(s.tolerance_percent),
      rolling_avg_days: String(s.rolling_avg_days),
      client_id: s.client_id ?? "none",
    });
    setSegDialogOpen(true);
  };

  const saveSegment = async () => {
    if (!editingSegment) return;
    const { error } = await supabase.from("segments").update({
      name: segForm.name, currency: segForm.currency,
      monthly_budget: Number(segForm.monthly_budget),
      tolerance_percent: Number(segForm.tolerance_percent),
      rolling_avg_days: Number(segForm.rolling_avg_days),
      client_id: segForm.client_id === "none" ? null : segForm.client_id,
    }).eq("id", editingSegment.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Segmento actualizado");
    setSegDialogOpen(false);
    fetchAll();
  };

  const deleteSegment = async (id: string) => {
    await supabase.from("segments").delete().eq("id", id);
    toast.success("Segmento eliminado");
    fetchAll();
  };

  const deleteRuleGroup = async (groupId: string) => {
    await supabase.from("segment_rules").delete().eq("group_id", groupId);
    toast.success("Regla eliminada");
    try { await supabase.functions.invoke("compute-campaign-segment-map", { body: { workspace_id: wsId } }); } catch { }
    fetchAll();
  };

  const saveRuleGroup = async () => {
    if (!wsId || !ruleGroupSegmentId) return;
    const valid = ruleGroupConditions.filter((c) => c.rule_value.trim());
    if (!valid.length) { toast.error("Agregá al menos una condición"); return; }
    const groupId = crypto.randomUUID();
    const { error } = await supabase.from("segment_rules").insert(
      valid.map((c, i) => ({
        workspace_id: wsId, segment_id: ruleGroupSegmentId,
        platform: c.platform, rule_type: c.rule_type,
        rule_value: c.rule_value.trim(), priority: 100 + i, group_id: groupId,
      })),
    );
    if (error) { toast.error(error.message); return; }
    toast.success("Regla agregada");
    setRuleGroupDialogOpen(false);
    try { await supabase.functions.invoke("compute-campaign-segment-map", { body: { workspace_id: wsId } }); } catch { }
    fetchAll();
  };

  if (loading) return <div className="animate-pulse text-muted-foreground p-8">Cargando…</div>;

  return (
    <div className="space-y-6">
      <SectionHeader
        badge="Configuración"
        title="Segmentos"
        subtitle="Agrupá campañas en segmentos de presupuesto y análisis"
        action={
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={recompute} disabled={recomputing} className="gap-1.5">
                  <RefreshCw className={cn("h-3.5 w-3.5", recomputing && "animate-spin")} />
                  Recomputar
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs max-w-xs">
                Vuelve a aplicar todas las reglas contra las campañas y actualiza el mapping
              </TooltipContent>
            </Tooltip>
          </div>
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Segmentos", value: segments.length, color: "text-primary" },
          { label: "Asignadas", value: assigned.length, color: "text-success" },
          { label: "Sin asignar", value: unassigned.length, color: unassigned.length > 0 ? "text-warning" : "text-muted-foreground" },
          { label: "Conflictos", value: conflicts.length, color: conflicts.length > 0 ? "text-destructive" : "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="py-3 px-4">
              <p className={cn("text-2xl font-bold tabular-nums", color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="campaigns" className="text-xs gap-1.5">
            <Search className="h-3.5 w-3.5" />
            Campañas
            {unassigned.length > 0 && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 ml-1 text-warning border-warning/30">
                {unassigned.length} sin asignar
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="segments" className="text-xs gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Segmentos ({segments.length})
          </TabsTrigger>
        </TabsList>

        {/* ── CAMPAIGNS TAB ── */}
        <TabsContent value="campaigns" className="space-y-4">
          {/* Selection toolbar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar campaña…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            {selectedIds.size > 0 ? (
              <>
                <span className="text-xs text-muted-foreground">{selectedIds.size} seleccionada{selectedIds.size !== 1 ? "s" : ""}</span>
                <Button
                  size="sm"
                  className="gap-1.5 h-8"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Crear segmento con estas campañas
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={clearSelection}>
                  Limpiar
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={selectAll}>
                Seleccionar todas sin asignar
              </Button>
            )}
          </div>

          {/* Unassigned campaigns */}
          {filteredUnassigned.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-muted-foreground">
                  {unassigned.length === 0
                    ? "Todas las campañas están asignadas a un segmento"
                    : "Sin resultados para esa búsqueda"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <HelpCircle className="h-3.5 w-3.5 text-warning" />
                  Campañas sin asignar — seleccioná para crear un segmento
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredUnassigned.map((m) => {
                    const campaign = m.campaigns!;
                    const isSelected = selectedIds.has(campaign.id);
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer",
                          isSelected && "bg-primary/5",
                        )}
                        onClick={() => toggleSelect(campaign.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(campaign.id)}
                          className="shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] shrink-0",
                            campaign.provider === "meta" ? "border-blue-200 text-blue-600" : "border-green-200 text-green-600",
                          )}
                        >
                          {campaign.provider === "meta" ? "Meta" : "Google"}
                        </Badge>
                        <span className="text-xs flex-1 truncate font-medium">{campaign.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0 hidden md:block">
                          {campaign.external_id}
                        </span>
                        {isAdmin && segments.length > 0 && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <QuickAssignDialog
                              campaign={campaign}
                              segments={segments}
                              wsId={wsId}
                              onAssigned={fetchAll}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <Card className="border-destructive/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Conflictos — campañas que matchean más de un segmento ({conflicts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {conflicts.slice(0, 20).map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                      <Badge variant="outline" className="text-[9px] shrink-0 border-destructive/30 text-destructive">
                        {m.campaigns?.provider}
                      </Badge>
                      <span className="truncate">{m.campaigns?.name ?? m.campaign_id}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                        Revisá las reglas
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── SEGMENTS TAB ── */}
        <TabsContent value="segments" className="space-y-4">
          {isAdmin && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  setEditingSegment(null);
                  setSegForm({ name: "", currency: "USD", monthly_budget: "0", tolerance_percent: "0.07", rolling_avg_days: "3", client_id: "none" });
                  setSegDialogOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Nuevo segmento
              </Button>
            </div>
          )}

          {segments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Layers className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground mb-1">Sin segmentos todavía</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Andá a la pestaña Campañas, seleccioná las que van juntas y creá un segmento desde ahí
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {segments.map((seg) => {
                const segRules = rules.filter((r) => r.segment_id === seg.id);
                const ruleGroups = groupRules(segRules);
                const segCampaigns = assigned.filter((m) => m.segment_id === seg.id);
                const clientName = clients.find((c) => c.id === seg.client_id)?.name;

                return (
                  <Card key={seg.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-sm">{seg.name}</CardTitle>
                            {clientName && (
                              <Badge variant="outline" className="text-[9px]">{clientName}</Badge>
                            )}
                            <Badge variant="secondary" className="text-[9px]">
                              {segCampaigns.length} campaña{segCampaigns.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {seg.currency} {Number(seg.monthly_budget) > 0 ? `· Budget $${Number(seg.monthly_budget).toLocaleString()}` : "· Sin budget"}
                          </p>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEditSegment(seg)}>
                              Editar
                            </Button>
                            <Button
                              variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                              onClick={() => deleteSegment(seg.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0 space-y-3">
                      {/* Rules */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Reglas de clasificación
                          </span>
                          {isAdmin && (
                            <Button
                              variant="ghost" size="sm"
                              className="h-5 text-[10px] px-2 gap-1"
                              onClick={() => {
                                setRuleGroupSegmentId(seg.id);
                                setRuleGroupConditions([{ platform: "any", rule_type: "contains", rule_value: "" }]);
                                setRuleGroupDialogOpen(true);
                              }}
                            >
                              <Plus className="h-3 w-3" /> Agregar regla
                            </Button>
                          )}
                        </div>

                        {ruleGroups.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Sin reglas — las campañas no se asignan automáticamente</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {ruleGroups.map((group, gi) => (
                              <div key={group.group_id} className="flex items-center gap-1">
                                {gi > 0 && (
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase px-0.5">OR</span>
                                )}
                                <div className="flex items-center gap-1 bg-muted/40 border rounded-md px-2 py-1">
                                  {group.rules.map((r, ri) => (
                                    <span key={r.id} className="contents">
                                      {ri > 0 && (
                                        <Badge variant="outline" className="text-[8px] font-bold bg-primary/10 text-primary border-primary/20 px-1">
                                          AND
                                        </Badge>
                                      )}
                                      <code className="text-[10px] text-foreground">
                                        {r.platform !== "any" && <span className="text-muted-foreground">{r.platform}:</span>}
                                        {r.rule_type === "contains" ? "" : `${r.rule_type}:`}
                                        <span className="font-semibold">"{r.rule_value}"</span>
                                      </code>
                                    </span>
                                  ))}
                                  {isAdmin && (
                                    <button
                                      onClick={() => deleteRuleGroup(group.group_id)}
                                      className="ml-1 text-muted-foreground/40 hover:text-destructive transition-colors"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Matched campaigns preview */}
                      {segCampaigns.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {segCampaigns.slice(0, 8).map((m) => (
                            <span key={m.id} className="text-[10px] bg-success/10 text-success rounded px-1.5 py-0.5 font-medium truncate max-w-[180px]">
                              {m.campaigns?.name ?? m.campaign_id}
                            </span>
                          ))}
                          {segCampaigns.length > 8 && (
                            <span className="text-[10px] text-muted-foreground">+{segCampaigns.length - 8} más</span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Create from campaigns dialog ── */}
      <CreateFromCampaignsDialog
        open={createDialogOpen}
        onClose={() => { setCreateDialogOpen(false); clearSelection(); }}
        selectedCampaigns={selectedCampaigns}
        wsId={wsId}
        clients={clients}
        onCreated={() => { fetchAll(); clearSelection(); }}
      />

      {/* ── Edit segment dialog ── */}
      <Dialog open={segDialogOpen} onOpenChange={setSegDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">{editingSegment ? "Editar" : "Nuevo"} segmento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs mb-1.5 block">Nombre</Label>
              <Input value={segForm.name} onChange={(e) => setSegForm({ ...segForm, name: e.target.value })} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Cliente</Label>
              <Select value={segForm.client_id} onValueChange={(v) => setSegForm({ ...segForm, client_id: v })}>
                <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cliente</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs mb-1.5 block">Budget mensual</Label>
                <Input type="number" value={segForm.monthly_budget} onChange={(e) => setSegForm({ ...segForm, monthly_budget: e.target.value })} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Moneda</Label>
                <Input value={segForm.currency} onChange={(e) => setSegForm({ ...segForm, currency: e.target.value })} className="text-sm" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={saveSegment}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add rule group dialog ── */}
      <Dialog open={ruleGroupDialogOpen} onOpenChange={setRuleGroupDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Agregar regla al segmento</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">
            Condiciones AND dentro del grupo · Múltiples grupos = OR entre sí
          </p>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {ruleGroupConditions.map((cond, idx) => (
              <div key={idx} className="space-y-2 p-3 rounded-lg bg-muted/30 border relative">
                {idx > 0 && (
                  <Badge variant="outline" className="absolute -top-2.5 left-3 text-[9px] font-bold bg-primary/10 text-primary border-primary/20">AND</Badge>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Select value={cond.platform} onValueChange={(v) => setRuleGroupConditions((prev) => prev.map((c, i) => i === idx ? { ...c, platform: v } : c))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Cualquiera</SelectItem>
                      <SelectItem value="meta">Meta</SelectItem>
                      <SelectItem value="google_ads">Google Ads</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={cond.rule_type} onValueChange={(v) => setRuleGroupConditions((prev) => prev.map((c, i) => i === idx ? { ...c, rule_type: v } : c))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contiene</SelectItem>
                      <SelectItem value="starts_with">Empieza con</SelectItem>
                      <SelectItem value="regex">Regex</SelectItem>
                      <SelectItem value="in_list">Lista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  className="h-8 text-xs font-mono"
                  value={cond.rule_value}
                  onChange={(e) => setRuleGroupConditions((prev) => prev.map((c, i) => i === idx ? { ...c, rule_value: e.target.value } : c))}
                  placeholder="Valor a buscar en el nombre de la campaña"
                />
                {ruleGroupConditions.length > 1 && (
                  <button
                    className="absolute top-2 right-2 text-muted-foreground/40 hover:text-destructive"
                    onClick={() => setRuleGroupConditions((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Live preview */}
          {ruleGroupConditions[0]?.rule_value && (
            <div className="bg-muted/30 rounded-lg p-3">
              <LivePreview
                campaigns={allCampaigns}
                ruleType={ruleGroupConditions[0].rule_type}
                ruleValue={ruleGroupConditions[0].rule_value}
                platform={ruleGroupConditions[0].platform}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline" size="sm" className="flex-1 text-xs gap-1"
              onClick={() => setRuleGroupConditions((prev) => [...prev, { platform: "any", rule_type: "contains", rule_value: "" }])}
            >
              <Plus className="h-3 w-3" /> Agregar condición AND
            </Button>
            <Button size="sm" className="flex-1" onClick={saveRuleGroup}>
              Guardar regla
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SegmentsSettings;
