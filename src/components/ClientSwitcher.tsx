import { useState } from "react";
import { useClient } from "@/contexts/ClientContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Users, Plus } from "lucide-react";
import { toast } from "sonner";

const ClientSwitcher = () => {
  const { clients, selectedClient, setSelectedClient, refetch } = useClient();
  const { currentWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !currentWorkspace) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("clients")
      .insert({ name: name.trim(), workspace_id: currentWorkspace.id })
      .select()
      .single();
    if (error) {
      toast.error("Error al crear cliente");
    } else {
      toast.success("Cliente creado");
      refetch();
      if (data) setSelectedClient(data as any);
      setName("");
      setOpen(false);
    }
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-1">
      <Select
        value={selectedClient?.id ?? ""}
        onValueChange={(id) => {
          const c = clients.find((cl) => cl.id === id) ?? null;
          setSelectedClient(c);
        }}
      >
        <SelectTrigger className="flex-1 h-8 text-xs">
          <div className="flex items-center gap-1.5 truncate">
            <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Seleccionar cliente" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {clients.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1.5">Sin clientes</p>
          )}
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id} className="text-xs">
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        onClick={() => setOpen(true)}
        title="Nuevo cliente"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Nombre del cliente</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Marca ABC"
                className="mt-1"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={saving || !name.trim()}>
              {saving ? "Creando…" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientSwitcher;
