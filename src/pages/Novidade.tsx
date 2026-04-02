import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChatPanel } from "@/features/chat/ChatPanel";
import { PromptInput } from "@/components/PromptInput";
import { Button } from "@/components/ui/button";
import { FileManagerProvider, useFileManager } from "@/vfs/manager";
import { type GitSnapshot, listGitSnapshots } from "@/lib/git-utils";
import { getPublishJobStatus, postPublish } from "@/lib/publishApi";
import { useAuthStore } from "@/store/useAuthStore";
import { getNovidadeProject, type NovidadeMessage } from "@/lib/novidadeApi";
import { PreviewToolbar } from "@/features/preview/PreviewToolbar";

function IdeashipLogo({ width = 28, height = 28, fill = "white" }: { width?: number; height?: number; fill?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill={fill} width={width} height={height} aria-hidden="true">
      <path d="M256 16c0-7 4.5-13.2 11.2-15.3s13.9 .4 17.9 6.1l224 320c3.4 4.9 3.8 11.3 1.1 16.6s-8.2 8.6-14.2 8.6l-224 0c-8.8 0-16-7.2-16-16l0-320zM212.1 96.5c7 1.9 11.9 8.2 11.9 15.5l0 224c0 8.8-7.2 16-16 16L80 352c-5.7 0-11-3-13.8-8s-2.9-11-.1-16l128-224c3.6-6.3 11-9.4 18-7.5zM5.7 404.3C2.8 394.1 10.5 384 21.1 384l533.8 0c10.6 0 18.3 10.1 15.4 20.3l-4 14.3C550.7 473.9 500.4 512 443 512L133 512C75.6 512 25.3 473.9 9.7 418.7l-4-14.3z" />
    </svg>
  );
}

function inlineAssets(indexHtml: string, files: Record<string, string>, entryPath = "/index.html"): string {
  let html = indexHtml;
  const entryDir = entryPath.includes("/") ? entryPath.slice(0, entryPath.lastIndexOf("/") + 1) : "/";

  const buildPathVariants = (clean: string) => {
    const basename = clean.split("/").pop() || clean;
    const entryRelative = clean.startsWith(entryDir) ? clean.slice(entryDir.length) : clean;
    const unique = Array.from(
      new Set([
        clean,
        `/${clean}`,
        `./${clean}`,
        basename,
        `./${basename}`,
        entryRelative,
        `./${entryRelative}`,
      ])
    ).filter(Boolean);

    return unique.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  };

  for (const [path, content] of Object.entries(files)) {
    const clean = path.replace(/^\//, "");
    const pathVariants = buildPathVariants(clean);

    if (clean.endsWith(".css")) {
      const hrefRegex = new RegExp(
        `<link[^>]+href=["'](?:${pathVariants})["'][^>]*>`,
        "gi"
      );
      html = html.replace(hrefRegex, `<style>\n${content}\n</style>`);
    }
    if (clean.endsWith(".js")) {
      const scriptRegex = new RegExp(
        `<script[^>]+src=["'](?:${pathVariants})["'][^>]*><\\/script>`,
        "gi"
      );
      html = html.replace(scriptRegex, `<script>\n${content}\n<\/script>`);
    }
  }

  return html;
}

function NovidadeInner() {
  const { files, setFiles, resetFilesToDefault } = useFileManager();
  const usuario = useAuthStore((s) => s.usuario);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const routeProjectId = (searchParams.get("project") || "").trim() || null;
  const isWorkspaceRoute =
    location.pathname.startsWith("/novidade/workspace");

  const [projectId, setProjectId] = useState<string | null>(routeProjectId);
  const [initialMessages, setInitialMessages] = useState<NovidadeMessage[]>([]);
  const [chatPanelKey, setChatPanelKey] = useState("novidade-chat-new");
  const [loadingProject, setLoadingProject] = useState(false);
  const [publishSlug, setPublishSlug] = useState("");
  const [publishJobId, setPublishJobId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publicSiteUrl, setPublicSiteUrl] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<GitSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [landingPrompt, setLandingPrompt] = useState("");
  const [queuedFirstPrompt, setQueuedFirstPrompt] = useState<{ text: string; image?: string } | null>(null);

  const previewEntryPath = useMemo(() => {
    if (files["/index.html"]) return "/index.html";
    if (files["index.html"]) return "index.html";
    const firstHtml = Object.keys(files).find((key) => key.toLowerCase().endsWith(".html"));
    return firstHtml || null;
  }, [files]);

  const previewHtml = useMemo(() => {
    if (!previewEntryPath) return "<html><body><p>Nenhum arquivo HTML gerado ainda.</p></body></html>";
    const entry = files[previewEntryPath] || files[`/${previewEntryPath}`];
    if (!entry) return "<html><body><p>Nenhum arquivo HTML gerado ainda.</p></body></html>";
    return inlineAssets(entry, files, previewEntryPath.startsWith("/") ? previewEntryPath : `/${previewEntryPath}`);
  }, [files, previewEntryPath]);

  const previewKey = useMemo(() => {
    const head = previewHtml.slice(0, 180);
    let hash = 0;
    for (let i = 0; i < head.length; i += 1) {
      hash = (hash * 31 + head.charCodeAt(i)) | 0;
    }
    return `${previewRevision}-${Object.keys(files).length}-${previewHtml.length}-${Math.abs(hash)}`;
  }, [files, previewHtml, previewRevision]);

  const latestSnapshot = snapshots[0] ?? null;

  useEffect(() => {
    const iframe = previewIframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      const clickHandler = (event: Event) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;

        const clickable = target.closest("a, button") as HTMLElement | null;
        if (!clickable) return;

        if (clickable.tagName.toLowerCase() !== "a") return;

        const anchor = clickable as HTMLAnchorElement;
        const href = (anchor.getAttribute("href") || "").trim();
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

        event.preventDefault();
      };

      doc.addEventListener("click", clickHandler, true);
    };

    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
  }, [previewKey]);

  const navigateToWorkspace = (nextProjectId: string | null, replace = true) => {
    const params = new URLSearchParams();
    if (nextProjectId) {
      params.set("project", nextProjectId);
    }
    const query = params.toString();
    navigate(`/novidade/workspace${query ? `?${query}` : ""}`, { replace });
  };

  useEffect(() => {
    if (isWorkspaceRoute) return;
    if (!routeProjectId) return;
    const params = new URLSearchParams();
    params.set("project", routeProjectId);
    navigate(`/novidade/workspace?${params.toString()}`, { replace: true });
  }, [isWorkspaceRoute, navigate, routeProjectId]);

  useEffect(() => {
    if (!isWorkspaceRoute || !routeProjectId) return;

    let cancelled = false;
    const loadProject = async () => {
      setLoadingProject(true);
      setError(null);
      try {
        const project = await getNovidadeProject(routeProjectId);
        if (cancelled) return;

        const normalizedFiles = Object.entries(project.files || {}).reduce<Record<string, string>>(
          (acc, [key, value]) => {
            const normalized = key.startsWith("/") ? key : `/${key}`;
            acc[normalized] = value;
            return acc;
          },
          {}
        );

        if (Object.keys(normalizedFiles).length > 0) {
          setFiles(normalizedFiles);
        }

        setInitialMessages(project.messages || []);
        setProjectId(project.projectId || routeProjectId);
        setChatPanelKey(`novidade-chat-${project.projectId || routeProjectId}`);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Falha ao carregar o projeto");
        }
      } finally {
        if (!cancelled) {
          setLoadingProject(false);
        }
      }
    };

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, [isWorkspaceRoute, routeProjectId, setFiles]);

  useEffect(() => {
    if (!projectId) {
      setSnapshots([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await listGitSnapshots(projectId);
        if (!cancelled) setSnapshots(rows);
      } catch {
        if (!cancelled) setSnapshots([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!publishJobId) return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (intervalId !== undefined) clearInterval(intervalId);
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const job = await getPublishJobStatus(publishJobId);
        if (cancelled) return;
        if (job.status === "success") {
          setPublishing(false);
          setPublishJobId(null);
          const result = (job.result || {}) as Record<string, unknown>;
          const siteUrl = typeof result.siteUrl === "string" ? result.siteUrl : null;
          setPublicSiteUrl(siteUrl);
          stop();
        } else if (job.status === "failed") {
          setPublishing(false);
          setPublishJobId(null);
          setError(job.error || "Falha na publicacao");
          stop();
        } else {
          setPublishing(true);
        }
      } catch (e) {
        if (!cancelled) {
          setPublishing(false);
          setError(e instanceof Error ? e.message : "Erro ao acompanhar o status da publicacao");
          stop();
        }
      }
    };

    void poll();
    intervalId = setInterval(() => void poll(), 3000);

    return () => {
      cancelled = true;
      stop();
    };
  }, [publishJobId]);

  const handlePublish = async () => {
    if (!usuario?.id) {
      setError("Usuario nao autenticado");
      return;
    }
    try {
      setError(null);
      setPublishing(true);
      const payloadFiles = Object.entries(files).map(([path, content]) => ({
        path: path.replace(/^\//, ""),
        content,
      }));
      const res = await postPublish({
        userId: usuario.id,
        projectId,
        files: payloadFiles,
        slug: publishSlug.trim() || undefined,
      });
      setPublishJobId(res.jobId);
    } catch (e) {
      setPublishing(false);
      setError(e instanceof Error ? e.message : "Falha ao publicar");
    }
  };

  const previewHost = typeof window !== "undefined" ? window.location.host : "ideaship.io";

  const userInitial = (usuario?.nome?.trim()?.[0] || "e").toUpperCase();

  const handleLandingSend = (message: { content: { text: string; image: string } }) => {
    const text = message.content.text.trim();
    if (!text) return;

    resetFilesToDefault();
    setInitialMessages([]);
    setChatPanelKey(`novidade-chat-new-${Date.now()}`);
    setProjectId(null);
    setSnapshots([]);
    setPublishSlug("");
    setPublicSiteUrl(null);
    setError(null);

    setQueuedFirstPrompt({ text, image: message.content.image || undefined });
    setLandingPrompt("");
    navigateToWorkspace(null, false);
  };

  if (!isWorkspaceRoute) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(193,95,60,0.22),transparent_42%),radial-gradient(circle_at_90%_20%,rgba(230,177,144,0.22),transparent_40%),linear-gradient(180deg,#f8f2ed_0%,#f6efe8_45%,#f3ece4_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#f0e6dc] to-transparent" />

        <header className="relative z-10 mx-auto flex w-full max-w-[1280px] items-center justify-between px-6 py-4 md:py-5">
          <div className="flex items-center gap-2 text-primary">
            <IdeashipLogo width={24} height={24} fill="currentColor" />
            <span className="text-[26px] font-semibold leading-none tracking-[-0.01em] text-foreground">Laurena Builder</span>
          </div>

          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <button type="button" className="transition-colors hover:text-foreground">Recursos</button>
            <button type="button" className="transition-colors hover:text-foreground">Suporte</button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
              {userInitial}
            </div>
          </div>
        </header>

        <section className="relative z-10 mx-auto flex min-h-[calc(100vh-84px)] w-full max-w-[1280px] flex-col items-center px-6 pb-16 pt-14 text-center md:pt-20">
          <h1 className="max-w-5xl text-balance text-[44px] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground md:text-[72px]">
            Crie seu site com IA e publique em minutos.
          </h1>
          <p className="mt-5 max-w-[900px] text-balance text-[19px] leading-[1.45] text-muted-foreground md:text-[28px] md:leading-[1.35]">
            Descreva sua ideia, envie imagens e deixe a Laurena gerar paginas prontas para preview e deploy.
          </p>

          <div className="mt-10 w-full max-w-[860px] rounded-2xl border border-[#e7c0aa] bg-gradient-to-br from-[#fff4ec] via-[#fff9f5] to-[#ffe8da] p-3 shadow-[0_10px_28px_rgba(207,101,55,0.14)] sm:p-4">
            <PromptInput
              onSendMessage={handleLandingSend}
              input={landingPrompt}
              setInput={setLandingPrompt}
              handleInputChange={(e) => setLandingPrompt(e.target.value)}
              onError={(msg) => setError(msg)}
              height={82}
              variant="landing"
              placeholder="Descreva o site que voce quer criar..."
            />
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>

          <div className="mt-12 w-full max-w-[860px] text-left">
            <h2 className="text-[34px] font-semibold leading-none tracking-[-0.02em] text-foreground">Suas conversas</h2>
            <p className="mt-2 text-sm text-muted-foreground">Envie o primeiro prompt para abrir o workspace com preview ao vivo.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-[680px] overflow-hidden bg-[linear-gradient(180deg,#f7f3ef_0%,#f1ebe5_100%)]">
      <section className="flex w-full max-w-[450px] min-w-[320px] flex-col border-r border-[#e2c7b5] bg-white/80 text-foreground backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-[#e2c7b5] px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Novidade</p>
            <h2 className="text-sm font-semibold text-foreground">Laurena Builder</h2>
          </div>
          <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
            {projectId ? "Conectado" : "Nova sessao"}
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-[#e2c7b5] bg-[#fffaf6] px-4 py-2 text-xs text-muted-foreground">
          <span>Snapshots: {snapshots.length}</span>
          <span className="truncate pl-2">
            {latestSnapshot ? new Date(latestSnapshot.createdAt).toLocaleTimeString() : "Sem snapshots ainda"}
          </span>
        </div>

        <div className="min-h-0 flex-1 p-3">
          {loadingProject ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-[#e2c7b5] bg-white/70">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                carregando projeto...
              </div>
            </div>
          ) : (
            <ChatPanel
              key={chatPanelKey}
              initialMessages={initialMessages}
              initialProjectId={projectId}
              onProjectIdChange={(id) => {
                setProjectId(id);
                navigateToWorkspace(id, true);
              }}
              autoSendText={queuedFirstPrompt?.text || null}
              autoSendImage={queuedFirstPrompt?.image || null}
              onAutoSendConsumed={() => setQueuedFirstPrompt(null)}
            />
          )}
        </div>
      </section>

      <section className="flex min-w-0 flex-1 flex-col bg-transparent">
        <header className="flex items-center justify-between border-b border-[#e2c7b5] bg-white/70 px-4 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            {projectId ? `projeto: ${projectId.slice(0, 8)}...` : "pronto para gerar"}
          </div>

          <div className="flex items-center gap-2">
            {publicSiteUrl && (
              <Button variant="outline" onClick={() => window.open(publicSiteUrl, "_blank")}>
                Ver site
              </Button>
            )}
            <Button onClick={() => void handlePublish()} disabled={publishing} className="min-w-[170px]">
              {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
              {publishing ? "Publicando..." : "Preview e Deploy"}
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 p-4">
          <div className="h-full overflow-hidden rounded-2xl border border-[#e7c0aa] bg-gradient-to-br from-[#fff4ec] via-[#fff9f5] to-[#ffe8da] p-3 shadow-[0_10px_28px_rgba(207,101,55,0.14)] sm:p-4">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#edd1c1] bg-white">
              <PreviewToolbar host={previewHost} onRefresh={() => setPreviewRevision((n) => n + 1)} />
              <iframe
                ref={previewIframeRef}
                key={previewKey}
                title="Novidade Preview"
                srcDoc={previewHtml}
                className="h-full w-full border-0"
                sandbox="allow-scripts allow-forms allow-same-origin"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{publishSlug ? `slug: ${publishSlug}` : "slug automatico"}</span>
            <span>
              {latestSnapshot ? `ultimo snapshot: ${latestSnapshot.commitHash.slice(0, 7)}` : "sem snapshots ainda"}
            </span>
          </div>

          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
      </section>
    </div>
  );
}

export default function Novidade() {
  return (
    <FileManagerProvider>
      <NovidadeInner />
    </FileManagerProvider>
  );
}
