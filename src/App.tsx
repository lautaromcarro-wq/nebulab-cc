import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ClientProvider } from "@/contexts/ClientContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import Home from "@/pages/Home";
import SegmentsSettings from "@/pages/SegmentsSettings";
import Performance from "@/pages/Performance";
import Connections from "@/pages/Connections";
import AdminOps from "@/pages/AdminOps";
import FinancialSettings from "@/pages/FinancialSettings";
import ClientHub from "@/pages/ClientHub";
import Changelog from "@/pages/Changelog";
import ChangelogDashboard from "@/pages/ChangelogDashboard";
import Creatives from "@/pages/Creatives";
import Finance from "@/pages/Finance";
import Experiments from "@/pages/Experiments";
import WorkspaceSettings from "@/pages/WorkspaceSettings";
import WorkspaceMembers from "@/pages/WorkspaceMembers";
import Billing from "@/pages/Billing";
import BudgetTracker from "@/pages/BudgetTracker";
import Tasks from "@/pages/Tasks";
import Analytics from "@/pages/Analytics";
import Ecommerce from "@/pages/Ecommerce";
import ClientReport from "@/pages/ClientReport";
import Reports from "@/pages/Reports";
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
            <Route path="/report/:token" element={<ClientReport />} />
            <Route
              element={
                <ProtectedRoute>
                  <WorkspaceProvider>
                    <ClientProvider>
                      <AppLayout />
                    </ClientProvider>
                  </WorkspaceProvider>
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Home />} />
              <Route path="/clients" element={<ClientHub />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/creatives" element={<Creatives />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/changelog" element={<Changelog />} />
              <Route path="/changelog/dashboard" element={<ChangelogDashboard />} />
              <Route path="/experiments" element={<Experiments />} />
              <Route path="/connections" element={<Connections />} />
              <Route path="/settings/segments" element={<SegmentsSettings />} />
              <Route path="/admin/ops" element={<AdminOps />} />
              <Route path="/settings/financial" element={<FinancialSettings />} />
              <Route path="/settings/workspace" element={<WorkspaceSettings />} />
              <Route path="/settings/members" element={<WorkspaceMembers />} />
              <Route path="/admin/billing" element={<Billing />} />
              <Route path="/budget" element={<BudgetTracker />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/ecommerce" element={<Ecommerce />} />
              <Route path="/reports" element={<Reports />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
