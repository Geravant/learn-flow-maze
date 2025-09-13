import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ComputerUse from "./pages/ComputerUse";
import WebRTCTest from "./pages/WebRTCTest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Get the base path for GitHub Pages
const basename = import.meta.env.PROD ? '/learn-flow-maze' : '';

// Use HashRouter for GitHub Pages if VITE_USE_HASH_ROUTER is set
const useHashRouter = import.meta.env.VITE_USE_HASH_ROUTER === 'true';
const Router = useHashRouter ? HashRouter : BrowserRouter;
const routerProps = useHashRouter ? {} : { basename };

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router {...routerProps}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/computer-use" element={<ComputerUse />} />
          <Route path="/webrtc-test" element={<WebRTCTest />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
