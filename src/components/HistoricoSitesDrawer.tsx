import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { History, Loader2, ArrowRight } from "lucide-react";
import api from "@/lib/api";
import { useCriarSiteJobStore } from "@/store/useCriarSiteJobStore";
import { type Mensagem } from "@/lib/criarSiteChat";

interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  created_at: string;
  has_site: boolean;
}

interface SiteStatusResponse {
  project_id: string;
  project_name: string;
  status: string;
  preview_url?: string;
  download_url?: string;
  github_repo_url?: string;
  site_url?: string;
  cloud_run_url?: string;
  publish_slug?: string;
  messages?: { role: string; content: string }[];
}

export function HistoricoSitesDrawer() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const resetAll = useCriarSiteJobStore((s) => s.resetAll);
  const setProjectId = useCriarSiteJobStore((s) => s.setProjectId);
  const setLista = useCriarSiteJobStore((s) => s.setLista);
  const setSiteResult = useCriarSiteJobStore((s) => s.setSiteResult);
  const setGithubUrl = useCriarSiteJobStore((s) => s.setGithubUrl);
  const setPublicSiteUrl = useCriarSiteJobStore((s) => s.setPublicSiteUrl);
  const setPublishSlug = useCriarSiteJobStore((s) => s.setPublishSlug);

  async function loadHistorico() {
    try {
      setLoading(true);
      const { data } = await api.get<ProjectSummary[]>("/sites/");
      setProjects(data);
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      loadHistorico();
    }
  }, [open]);

  async function handleLoadProject(projectId: string) {
    try {
      setLoadingId(projectId);
      const { data } = await api.get<SiteStatusResponse>(`/sites/${projectId}`);
      
      resetAll(); // Clear current browser state first
      
      setProjectId(data.project_id);
      
      if (data.preview_url || data.download_url) {
        setSiteResult({
          previewUrl: data.preview_url || "",
          downloadUrl: data.download_url || "",
        });
      }
      if (data.github_repo_url) setGithubUrl(data.github_repo_url);
      if (data.site_url || data.cloud_run_url) {
        setPublicSiteUrl(data.site_url || data.cloud_run_url || null);
      }
      if (data.publish_slug) setPublishSlug(data.publish_slug);

      // Reconstruct chat history if available
      if (data.messages && data.messages.length > 0) {
        const msgs: Mensagem[] = [
           { id: "0", papel: "bot", texto: "Olá novamente! Aqui está o histórico da nossa conversa anterior." }
        ];
        
        data.messages.forEach((m, i) => {
          msgs.push({
            id: `db-${i}`,
            papel: m.role === "user" ? "user" : "bot",
            texto: m.content,
          });
        });
        
        setLista(msgs);
      }

      setOpen(false); // Close drawer
    } catch (error) {
      console.error("Erro ao carregar detalhes do projeto:", error);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 rounded-full h-9 gap-1.5 text-xs font-normal border-border/80">
          <History className="w-3.5 h-3.5 opacity-70" />
          Histórico
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <History className="w-4 h-4" /> 
            Meus Sites
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum site encontrado no seu histórico.</p>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id} className="p-3 border rounded-xl flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-foreground truncate">{p.name || "Site sem nome"}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(p.created_at).toLocaleDateString()} · {p.has_site ? "Gerado" : "Rascunho"}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="rounded-full shrink-0 ml-2"
                  onClick={() => handleLoadProject(p.id)}
                  disabled={loadingId === p.id}
                >
                  {loadingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
