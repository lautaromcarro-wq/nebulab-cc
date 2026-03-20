import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save } from "lucide-react";

const CURRENCIES = ["USD", "ARS", "MXN", "BRL", "CLP", "COP", "PEN", "EUR"];
const TIMEZONES = [
  "America/Mexico_City",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Santiago",
  "America/Lima",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "UTC",
];

const WorkspaceSettings = () => {
  const { currentWorkspace, setCurrentWorkspace, workspaceRole } = useWorkspace();
  const isAdmin = workspaceRole === "admin";

  const [form, setForm] = useState({
    name: "",
    currency: "ARS",
    timezone: "America/Argentina/Buenos_Aires",
    monthly_budget: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      setForm({
        name: currentWorkspace.name,
        currency: currentWorkspace.currency,
        timezone: currentWorkspace.timezone,
        monthly_budget: currentWorkspace.monthly_budget ? String(currentWorkspace.monthly_budget) : "",
      });
    }
  }, [currentWorkspace]);

  const handleSave = async () => {
    if (!currentWorkspace) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("workspaces")
      .update({
        name: form.name.trim(),
        currency: form.currency,
        timezone: form.timezone,
        monthly_budget: form.monthly_budget ? Number(form.monthly_budget) : null,
      })
      .eq("id", currentWorkspace.id)
      .select()
      .single();
    setSaving(false);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Workspace actualizado");
    if (data) setCurrentWorkspace(data as any);
  };

  if (!currentWorkspace) return <div className="text-sm text-muted-foreground p-8">Sin workspace seleccionado.</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workspace Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configuración general del workspace activo.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
          <CardDescription className="text-xs">Nombre, moneda base y timezone del workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nombre del Workspace</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              disabled={!isAdmin}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Moneda Base</Label>
              <Select value={form.currency} onValueChange={(v) => setForm((p) => ({ ...p, currency: v }))} disabled={!isAdmin}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Timezone</Label>
              <Select value={form.timezone} onValueChange={(v) => setForm((p) => ({ ...p, timezone: v }))} disabled={!isAdmin}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Budget Mensual Global (opcional)</Label>
            <p className="text-xs text-muted-foreground mb-1">Referencia de budget total del workspace para pacing global.</p>
            <div className="relative">
              <Input
                type="number"
                min={0}
                value={form.monthly_budget}
                onChange={(e) => setForm((p) => ({ ...p, monthly_budget: e.target.value }))}
                disabled={!isAdmin}
                className="pr-14"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{form.currency}</span>
            </div>
          </div>

          {isAdmin && (
            <div className="pt-2 flex justify-end border-t">
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                {saving ? "Guardando…" : "Guardar Cambios"}
              </Button>
            </div>
          )}
          {!isAdmin && (
            <p className="text-xs text-muted-foreground">Solo los admins pueden editar esta configuración.</p>
          )}
        </CardContent>
      </Card>

      {/* Workspace ID for reference */}
      <Card className="border-dashed">
        <CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Workspace ID:</span>{" "}
            <span className="font-mono">{currentWorkspace.id}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="font-medium text-foreground">Status:</span>{" "}
            <span className="capitalize">{currentWorkspace.status}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkspaceSettings;
