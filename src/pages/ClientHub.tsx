import { useState, useEffect } from "react";
import { useClient } from "@/contexts/ClientContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Globe, Users, Briefcase, Shield, Target, Swords } from "lucide-react";

// ── Financial Settings per client ──
interface FinSettings {
  avg_cogs_percent: number;
  shipping_percent: number;
  payment_fee_percent: number;
  refund_percent: number;
  iva_percent: number;
}

const defaultFin: FinSettings = { avg_cogs_percent: 0, shipping_percent: 0, payment_fee_percent: 0, refund_percent: 0, iva_percent: 0 };

const finFields: Array<{ key: keyof FinSettings; label: string; desc: string }> = [
  { key: "avg_cogs_percent", label: "COGS (%)", desc: "Costo de producción" },
  { key: "shipping_percent", label: "Envío (%)", desc: "Costo de envío" },
  { key: "payment_fee_percent", label: "Comisión pago (%)", desc: "Fee procesador" },
  { key: "refund_percent", label: "Devoluciones (%)", desc: "Tasa reembolsos" },
  { key: "iva_percent", label: "IVA (%)", desc: "Impuestos" },
];

export default function ClientHub() {
  const { selectedClient, refetch } = useClient();
  const { currentWorkspace, workspaceRole } = useWorkspace();
  const isAdmin = workspaceRole === "admin";

  if (!selectedClient) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Client Hub</h1>
        <div className="mt-8 rounded-lg border border-dashed p-12 text-center text-muted-foreground text-sm">
          No hay client seleccionado. Creá uno desde el panel lateral.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{selectedClient.name}</h1>
        <Badge variant="outline" className="text-xs">{selectedClient.status}</Badge>
        {selectedClient.website_url && (
          <a href={selectedClient.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <Globe className="h-3 w-3" />{selectedClient.website_url}
          </a>
        )}
      </div>

      <Tabs defaultValue="financial" className="space-y-4">
        <TabsList>
          <TabsTrigger value="financial" className="text-xs gap-1"><Briefcase className="h-3.5 w-3.5" />Financial</TabsTrigger>
          <TabsTrigger value="personas" className="text-xs gap-1"><Target className="h-3.5 w-3.5" />Personas</TabsTrigger>
          <TabsTrigger value="competitors" className="text-xs gap-1"><Swords className="h-3.5 w-3.5" />Competidores</TabsTrigger>
          <TabsTrigger value="vault" className="text-xs gap-1"><Shield className="h-3.5 w-3.5" />Vault</TabsTrigger>
        </TabsList>

        <TabsContent value="financial">
          <ClientFinancialTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="personas">
          <ClientPersonasTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="competitors">
          <ClientCompetitorsTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="vault">
          <ClientVaultTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Financial Settings Tab ──
function ClientFinancialTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [form, setForm] = useState<FinSettings>(defaultFin);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("client_financial_settings")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm({
            avg_cogs_percent: Number(data.avg_cogs_percent) || 0,
            shipping_percent: Number(data.shipping_percent) || 0,
            payment_fee_percent: Number(data.payment_fee_percent) || 0,
            refund_percent: Number(data.refund_percent) || 0,
            iva_percent: Number(data.iva_percent) || 0,
          });
        } else {
          setForm(defaultFin);
        }
        setLoading(false);
      });
  }, [clientId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("client_financial_settings")
        .upsert({ client_id: clientId, workspace_id: workspaceId, ...form, updated_at: new Date().toISOString() }, { onConflict: "client_id" });
      if (error) throw error;
      toast.success("Financial settings guardados");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const totalDeduction = Object.values(form).reduce((s, v) => s + (Number(v) || 0), 0);

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Porcentajes de deducción</CardTitle>
        <CardDescription>Total: {totalDeduction.toFixed(1)}% — Revenue × (100% − deducciones) − Spend = Contribution Margin</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {finFields.map(({ key, label, desc }) => (
          <div key={key} className="grid grid-cols-2 gap-4 items-center">
            <div>
              <Label htmlFor={key}>{label}</Label>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <div className="relative">
              <Input id={key} type="number" min={0} max={100} step={0.1} value={form[key]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                className="pr-8" disabled={!isAdmin}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>
        ))}
        {isAdmin && (
          <div className="pt-4 border-t flex justify-end">
            <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Personas Tab ──
function ClientPersonasTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [personas, setPersonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    const { data } = await supabase.from("buyer_personas").select("*").eq("client_id", clientId).order("created_at");
    setPersonas(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [clientId]);

  const handleAdd = async () => {
    await supabase.from("buyer_personas").insert({ client_id: clientId, workspace_id: workspaceId, name: "Nueva Persona" });
    fetch();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("buyer_personas").delete().eq("id", id);
    fetch();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <Button size="sm" variant="outline" onClick={handleAdd}><Plus className="h-3.5 w-3.5 mr-1.5" />Agregar Persona</Button>
      )}
      {personas.length === 0 && <p className="text-sm text-muted-foreground">No hay buyer personas definidas.</p>}
      {personas.map((p) => (
        <Card key={p.id}>
          <CardContent className="p-4 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{p.notes || "Sin notas"}</p>
            </div>
            {isAdmin && (
              <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Competitors Tab ──
function ClientCompetitorsTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    const { data } = await supabase.from("competitors").select("*").eq("client_id", clientId).order("name");
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [clientId]);

  const handleAdd = async () => {
    await supabase.from("competitors").insert({ client_id: clientId, workspace_id: workspaceId, name: "Nuevo Competidor" });
    fetch();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("competitors").delete().eq("id", id);
    fetch();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <Button size="sm" variant="outline" onClick={handleAdd}><Plus className="h-3.5 w-3.5 mr-1.5" />Agregar Competidor</Button>
      )}
      {items.length === 0 && <p className="text-sm text-muted-foreground">No hay competidores registrados.</p>}
      {items.map((c) => (
        <Card key={c.id}>
          <CardContent className="p-4 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium">{c.name}</p>
              {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline">{c.url}</a>}
            </div>
            {isAdmin && (
              <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Vault Tab ──
function ClientVaultTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    const { data } = await supabase.from("client_access_vault").select("*").eq("client_id", clientId).order("system_name");
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [clientId]);

  const handleAdd = async () => {
    await supabase.from("client_access_vault").insert({ client_id: clientId, workspace_id: workspaceId, system_name: "Nuevo Sistema" });
    fetch();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("client_access_vault").delete().eq("id", id);
    fetch();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Referencias a accesos (sin passwords). Usá un vault externo (1Password, Bitwarden) para credenciales.</p>
      {isAdmin && (
        <Button size="sm" variant="outline" onClick={handleAdd}><Plus className="h-3.5 w-3.5 mr-1.5" />Agregar Acceso</Button>
      )}
      {items.length === 0 && <p className="text-sm text-muted-foreground">No hay accesos registrados.</p>}
      {items.map((v) => (
        <Card key={v.id}>
          <CardContent className="p-4 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium">{v.system_name}</p>
              {v.username_or_email && <p className="text-xs text-muted-foreground">{v.username_or_email}</p>}
              {v.vault_link && <a href={v.vault_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Abrir en Vault</a>}
            </div>
            {isAdmin && (
              <Button size="icon" variant="ghost" onClick={() => handleDelete(v.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
