import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AppLayout from "@/components/AppLayout";
import NativeBackButton from "@/components/NativeBackButton";
import SearchPage from "./pages/SearchPage";
import WatchPage from "./pages/WatchPage";
import BrowsePage from "./pages/BrowsePage";
import SettingsPage from "./pages/SettingsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
    },
  },
});

/**
 * The native (Android TV) bundle is served off the local filesystem, where a
 * WebView reload on a deep path like /search has no server to fall back to
 * index.html. Hash routing survives that; the web build keeps clean URLs.
 */
const Router = import.meta.env.VITE_NATIVE ? HashRouter : BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router>
        <NativeBackButton />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/search" element={<AppLayout><SearchPage /></AppLayout>} />
          <Route path="/watch/:type/:id" element={<AppLayout><WatchPage /></AppLayout>} />
          <Route path="/browse/:category" element={<AppLayout><BrowsePage /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
