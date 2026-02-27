import { useState, useEffect } from "react";
import { useFinancialSettings, type FinancialSettings } from "@/hooks/useFinancialSettings";
import { useClient } from "@/contexts/ClientContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const fields: Array<{ key: keyof FinancialSettings; label: string; description: string }> = [
  { key: "avg_cogs_percent", label: "COGS promedio (%)", description: "Costo de producción como % del revenue" },
  { key: "shipping_percent", label: "Envío (%)", description: "Costo de envío como % del revenue" },
  { key: "payment_fee_percent", label: "Comisión de pago (%)", description: "Fee del procesador de pagos" },
  { key: "refund_percent", label: "Devoluciones (%)", description: "Tasa promedio de reembolsos" },
  { key: "iva_percent", label: "IVA / Impuestos (%)", description: "Impuestos sobre ventas" },
];

const FinancialSettingsPage = () => {
  const { settings, isLoading, save, isSaving } = useFinancialSettings();
  const { selectedClient } = useClient();
  const [form, setForm] = useState<FinancialSettings>(settings);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSave = async () => {
    try {
      await save(form);
      toast.success("Configuración financiera guardada");
    } catch {
      toast.error("Error al guardar");
    }
  };

  const totalDeduction = Object.values(form).reduce((sum, v) => sum + (Number(v) || 0), 0);

  if (isLoading) return <div className="p-8 text-muted-foreground text-sm">Cargando…</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Financial Settings</h1>
      <p className="text-muted-foreground text-sm mb-6">
        {selectedClient
          ? `Configuración financiera para ${selectedClient.name}`
          : "Configuración financiera global del workspace (sin client seleccionado)"}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Porcentajes de deducción</CardTitle>
          <CardDescription>
            Estos valores se aplican sobre el revenue para estimar costos. Total: {totalDeduction.toFixed(1)}%
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map(({ key, label, description }) => (
            <div key={key} className="grid grid-cols-2 gap-4 items-center">
              <div>
                <Label htmlFor={key}>{label}</Label>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <div className="relative">
                <Input
                  id={key}
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={form[key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
          ))}

          <div className="pt-4 flex items-center justify-between border-t">
            <div>
              <p className="text-sm font-medium">Margen estimado sobre revenue</p>
              <p className="text-xs text-muted-foreground">
                100% − {totalDeduction.toFixed(1)}% costos − Ad Spend = Contribution Margin
              </p>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialSettingsPage;
