import React, { createContext, useContext, useState, useEffect } from "react";
import { useWorkspace } from "./WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";

export interface Client {
  id: string;
  workspace_id: string;
  name: string;
  status: string;
  notes: string | null;
  website_url: string | null;
  industria: string | null;
  responsable_nebulab: string | null;
  prioridad: string | null;
  presupuesto_mensual_estimado: number | null;
  fecha_kickoff: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientContextType {
  clients: Client[];
  selectedClient: Client | null;
  setSelectedClient: (c: Client | null) => void;
  loading: boolean;
  refetch: () => void;
}

const ClientContext = createContext<ClientContextType>({
  clients: [],
  selectedClient: null,
  setSelectedClient: () => {},
  loading: true,
  refetch: () => {},
});

export const useClient = () => useContext(ClientContext);

export const ClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentWorkspace } = useWorkspace();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClientState] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchClients = async () => {
    if (!currentWorkspace) {
      setClients([]);
      setSelectedClientState(null);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("workspace_id", currentWorkspace.id)
      .eq("status", "active")
      .order("name");

    const list = (data as Client[] | null) ?? [];
    setClients(list);

    // Restore or pick first
    const savedId = localStorage.getItem("selected_client_id");
    const found = list.find((c) => c.id === savedId);
    setSelectedClientState(found ?? list[0] ?? null);
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, [currentWorkspace]);

  const setSelectedClient = (c: Client | null) => {
    setSelectedClientState(c);
    if (c) localStorage.setItem("selected_client_id", c.id);
    else localStorage.removeItem("selected_client_id");
  };

  return (
    <ClientContext.Provider value={{ clients, selectedClient, setSelectedClient, loading, refetch: fetchClients }}>
      {children}
    </ClientContext.Provider>
  );
};
