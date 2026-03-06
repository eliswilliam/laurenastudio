import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Layout
import AppLayout from "./components/layout/AppLayout";

// Auth pages
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import EsqueciSenha from "./pages/EsqueciSenha";
import RedefinirSenha from "./pages/RedefinirSenha";
import AuthCallback from './pages/AuthCallback';
import EscolherPlano from './pages/EscolherPlano';
import CheckoutSucesso from './pages/CheckoutSucesso';
// App pages
import Dashboard from "./pages/Dashboard";
import CriarPost from "./pages/CriarPost";
import AIStudio from "./pages/AIStudio";
import Agendador from "./pages/Agendador";
import Analytics from "./pages/Analytics";
import AdsAnalytics from "./pages/AdsAnalytics";
import BibliotecaMidia from "./pages/BibliotecaMidia";
import Pagamento from "./pages/Pagamento";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";

// Legacy blog template pages
import Index from "./pages/Index";
import Article from "./pages/Article";
import About from "./pages/About";
import Authors from "./pages/Authors";
import Contact from "./pages/Contact";
import Creativity from "./pages/Creativity";
import Growth from "./pages/Growth";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/escolher-plano" element={<EscolherPlano />} />
          <Route path="/checkout/sucesso" element={<CheckoutSucesso />} />

          {/* App routes (with sidebar layout) */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/criar-post" element={<CriarPost />} />
            <Route path="/ai-studio" element={<AIStudio />} />
            <Route path="/agendador" element={<Agendador />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/ads-analytics" element={<AdsAnalytics />} />
            <Route path="/midia" element={<BibliotecaMidia />} />
            <Route path="/pagamento" element={<Pagamento />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>

          {/* Home & Legacy blog template pages */}
          <Route path="/" element={<Index />} />
          <Route path="/blog" element={<Index />} />
          <Route path="/article/:id" element={<Article />} />
          <Route path="/about" element={<About />} />
          <Route path="/authors" element={<Authors />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/creativity" element={<Creativity />} />
          <Route path="/growth" element={<Growth />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
