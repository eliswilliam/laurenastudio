import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Layout
const AppLayout = lazy(() => import("./components/layout/AppLayout"));

// Auth pages
const Login = lazy(() => import("./pages/Login"));
const Registro = lazy(() => import("./pages/Registro"));
const EsqueciSenha = lazy(() => import("./pages/EsqueciSenha"));
const RedefinirSenha = lazy(() => import("./pages/RedefinirSenha"));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const EscolherPlano = lazy(() => import('./pages/EscolherPlano'));
const CheckoutSucesso = lazy(() => import('./pages/CheckoutSucesso'));
// App pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MarketingAI = lazy(() => import("./pages/MarketingAI"));
const AIStudio = lazy(() => import("./pages/AIStudio"));
const Analytics = lazy(() => import("./pages/Analytics"));
const AdsAnalytics = lazy(() => import("./pages/AdsAnalytics"));
const BibliotecaMidia = lazy(() => import("./pages/BibliotecaMidia"));
const Pagamento = lazy(() => import("./pages/Pagamento"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const PreviewPost = lazy(() => import("./pages/PreviewPost"));
const Editor = lazy(() => import("./pages/Editor"));
const CriarSite = lazy(() => import("./pages/CriarSite"));
const Novidade = lazy(() => import("./pages/Novidade"));
const Template = lazy(() => import("./pages/Template"));
const SitesPublicados = lazy(() => import("./pages/SitesPublicados"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Legacy blog template pages
const Index = lazy(() => import("./pages/Index"));
const Article = lazy(() => import("./pages/Article"));
const About = lazy(() => import("./pages/About"));
const Authors = lazy(() => import("./pages/Authors"));
const Contact = lazy(() => import("./pages/Contact"));
const Creativity = lazy(() => import("./pages/Creativity"));
const Growth = lazy(() => import("./pages/Growth"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
              Carregando...
            </div>
          }
        >
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
              <Route path="/criar-site" element={<CriarSite />} />
              <Route path="/novidade" element={<Novidade />} />
              <Route path="/novidade/workspace" element={<Novidade />} />
              <Route path="/marketing-ai" element={<MarketingAI />} />
              <Route path="/ai-studio" element={<AIStudio />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/ads-analytics" element={<AdsAnalytics />} />
              <Route path="/midia" element={<BibliotecaMidia />} />
              <Route path="/pagamento" element={<Pagamento />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/preview-post" element={<PreviewPost />} />
              <Route path="/editor" element={<Editor />} />
              <Route path="/template" element={<Template />} />
              <Route path="/sites-publicados" element={<SitesPublicados />} />
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
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
