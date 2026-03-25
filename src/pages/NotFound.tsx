import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { BrainCircuit, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background animate-fade-in">
      <div className="text-center space-y-6 animate-slide-up">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <BrainCircuit className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-6xl font-bold text-primary">404</h1>
          <p className="mt-2 text-xl text-muted-foreground">Página não encontrada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A página que você procura não existe ou foi removida.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/dashboard">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
