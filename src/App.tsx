import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import FunnelsPage from "./pages/FunnelsPage";
import FunnelDetailPage from "./pages/FunnelDetailPage";
import FunnelBuilderPage from "./pages/FunnelBuilderPage";
import LeadsPage from "./pages/LeadsPage";
import InsightsPage from "./pages/InsightsPage";
import LoginPage from "./pages/LoginPage";
import CampaignsPage from "./pages/CampaignsPage";
import CampaignDetailPage from "./pages/CampaignDetailPage";
import CampaignBuilderPage from "./pages/CampaignBuilderPage";
import ProductsPage from "./pages/ProductsPage";

const queryClient = new QueryClient();

// Protected layout — redirects to /login if not authenticated
function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/campaigns/new" element={<CampaignBuilderPage />} />
        <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="/funnels" element={<FunnelsPage />} />
        <Route path="/funnels/new" element={<FunnelBuilderPage />} />
        <Route path="/funnels/:id" element={<FunnelDetailPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<AppLayout />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
