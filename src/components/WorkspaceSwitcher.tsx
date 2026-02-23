import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WorkspaceSwitcher = () => {
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useWorkspace();

  if (workspaces.length <= 1) {
    return (
      <span className="text-sm font-semibold truncate max-w-[160px]">
        {currentWorkspace?.name ?? "Sin workspace"}
      </span>
    );
  }

  return (
    <Select
      value={currentWorkspace?.id ?? ""}
      onValueChange={(id) => {
        const ws = workspaces.find((w) => w.id === id);
        if (ws) setCurrentWorkspace(ws);
      }}
    >
      <SelectTrigger className="w-[180px] h-8 text-xs font-semibold border-none bg-transparent">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {workspaces.map((ws) => (
          <SelectItem key={ws.id} value={ws.id}>
            {ws.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default WorkspaceSwitcher;
