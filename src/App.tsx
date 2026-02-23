import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import Home from "@/pages/Home";
import SegmentsSettings from "@/pages/SegmentsSettings";
import Placeholder from "@/pages/Placeholder";
import Connections from "@/pages/Connections";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              element={
                <ProtectedRoute>
                  <WorkspaceProvider>
                    <AppLayout />
                  </WorkspaceProvider>
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Home />} />
              <Route path="/performance" element={<Placeholder title="Performance Overview" />} />
              <Route path="/creatives" element={<Placeholder title="Creative Performance" />} />
              <Route path="/finance" element={<Placeholder title="Finance & Unit Economics" />} />
              <Route path="/changelog" element={<Placeholder title="Bitácora" />} />
              <Route path="/experiments" element={<Placeholder title="Experiments Board" />} />
              <Route path="/connections" element={<Connections />} />
              <Route path="/settings/segments" element={<SegmentsSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
