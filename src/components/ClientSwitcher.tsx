import { useClient } from "@/contexts/ClientContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";

const ClientSwitcher = () => {
  const { clients, selectedClient, setSelectedClient } = useClient();

  if (clients.length === 0) return null;

  return (
    <Select
      value={selectedClient?.id ?? ""}
      onValueChange={(id) => {
        const c = clients.find((cl) => cl.id === id) ?? null;
        setSelectedClient(c);
      }}
    >
      <SelectTrigger className="w-full h-8 text-xs">
        <div className="flex items-center gap-1.5 truncate">
          <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Seleccionar cliente" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {clients.map((c) => (
          <SelectItem key={c.id} value={c.id} className="text-xs">
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ClientSwitcher;
