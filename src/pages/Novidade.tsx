import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ExternalLink,
  Eye,
  Loader2,
  MessageSquare,
  Monitor,
  Rocket,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useTranslation } from "@/hooks/useTranslation";

function LaurenaBuilderLogo({
  width = 28,
  height = 28,
  fill = "white",
}: {
  width?: number;
  height?: number;
  fill?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 576 512"
      fill={fill}
      width={width}
      height={height}
      aria-hidden="true"
    >
      <path d="M256 16c0-7 4.5-13.2 11.2-15.3s13.9 .4 17.9 6.1l224 320c3.4 4.9 3.8 11.3 1.1 16.6s-8.2 8.6-14.2 8.6l-224 0c-8.8 0-16-7.2-16-16l0-320zM212.1 96.5c7 1.9 11.9 8.2 11.9 15.5l0 224c0 8.8-7.2 16-16 16L80 352c-5.7 0-11-3-13.8-8s-2.9-11-.1-16l128-224c3.6-6.3 11-9.4 18-7.5zM5.7 404.3C2.8 394.1 10.5 384 21.1 384l533.8 0c10.6 0 18.3 10.1 15.4 20.3l-4 14.3C550.7 473.9 500.4 512 443 512L133 512C75.6 512 25.3 473.9 9.7 418.7l-4-14.3z" />
    </svg>
  );
}

function inlineAssets(
  indexHtml: string,
  files: Record<string, string>,
  entryPath = "/index.html"
): string {
  let html = indexHtml;
  const entryDir = entryPath.includes("/")
    ? entryPath.slice(0, entryPath.lastIndexOf("/") + 1)
    : "/";

  const buildPathVariants = (clean: string) => {
    const basename = clean.split("/").pop() || clean;
    const entryRelative = clean.startsWith(entryDir)
      ? clean.slice(entryDir.length)
      : clean;
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

// ── Slug security — mirrors backend dns_service.py RESERVED_SLUGS ──────────
const _NOVIDADE_RESERVED_SLUGS = new Set([
  'www', 'mail', 'smtp', 'pop', 'pop3', 'imap', 'ftp', 'sftp',
  'ns', 'ns1', 'ns2', 'ns3', 'ns4',
  'vpn', 'ssh', 'proxy', 'gateway',
  'api', 'api-v1', 'api-v2', 'app', 'apps',
  'admin', 'administrator', 'dashboard', 'panel', 'portal',
  'builder', 'editor', 'preview', 'publish',
  'dev', 'development', 'staging', 'stage', 'test', 'testing', 'beta', 'alpha', 'demo', 'sandbox',
  'static', 'cdn', 'assets', 'asset', 'media', 'img', 'images', 'files',
  'docs', 'documentation', 'help', 'support', 'faq', 'status', 'health', 'ping',
  'blog', 'news', 'shop', 'store', 'cart', 'pay', 'payment', 'payments', 'billing', 'checkout',
  'auth', 'login', 'logout', 'signup', 'register', 'account', 'oauth', 'sso', 'id', 'callback',
  'monitor', 'monitoring', 'metrics', 'grafana', 'kibana', 'logs',
  'internal', 'intranet', 'private', 'secure', 'corp', 'localhost', 'local',
  'laurenastudio', 'laurena', 'studio',
  'webhook', 'webhooks',
  'root', 'system', 'server',
]);

function _novSlugReserved(s: string): boolean {
  return _NOVIDADE_RESERVED_SLUGS.has(s.trim().toLowerCase());
}

type MobileTab = "chat" | "preview" | "publicar";

function NovidadeInner() {
  const { t, i18n } = useTranslation();
  const { files, setFiles, resetFilesToDefault } = useFileManager();
  const usuario = useAuthStore((s) => s.usuario);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const routeProjectId = (searchParams.get("project") || "").trim() || null;
  const isWorkspaceRoute =
    location.pathname.startsWith("/novidade/workspace") ||
    location.pathname.startsWith("/site");

  // Read first prompt passed via navigation state from the landing page.
  // location.state survives the component remount that happens when navigating
  // from /novidade (Route A) to /site (Route B) because React Router keeps the
  // history entry state intact when mounting the next route's component.
  const locationState = location.state as {
    firstPrompt?: { text: string; image?: string };
  } | null;

  const [projectId, setProjectId] = useState<string | null>(routeProjectId);
  const [initialMessages, setInitialMessages] = useState<NovidadeMessage[]>([]);
  const [chatPanelKey, setChatPanelKey] = useState("novidade-chat-new");
  const [loadingProject, setLoadingProject] = useState(false);
  const [publishSlug, setPublishSlug] = useState("");
  const [showDeployDialog, setShowDeployDialog] = useState(false);

  // Persist publishJobId in sessionStorage so polling resumes after a page refresh.
  const [publishJobId, setPublishJobIdState] = useState<string | null>(() => {
    try { return sessionStorage.getItem("novidade_pub_job") || null; } catch { return null; }
  });
  const setPublishJobId = (id: string | null) => {
    setPublishJobIdState(id);
    try {
      if (id) sessionStorage.setItem("novidade_pub_job", id);
      else sessionStorage.removeItem("novidade_pub_job");
    } catch { /* ignore */ }
  };

  const [publishing, setPublishing] = useState(false);

  // Persist the published URL so it survives a refresh while the user is still on /site.
  const [publicSiteUrl, setPublicSiteUrlState] = useState<string | null>(() => {
    try { return sessionStorage.getItem("novidade_site_url") || null; } catch { return null; }
  });
  const setPublicSiteUrl = (url: string | null) => {
    setPublicSiteUrlState(url);
    try {
      if (url) sessionStorage.setItem("novidade_site_url", url);
      else sessionStorage.removeItem("novidade_site_url");
    } catch { /* ignore */ }
  };

  const [snapshots, setSnapshots] = useState<GitSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [landingPrompt, setLandingPrompt] = useState("");

  // First prompt queued from the landing page — initialized from navigation state
  // so it persists across the remount caused by the /novidade → /site route change.
  const [queuedFirstPrompt, setQueuedFirstPrompt] = useState<{
    text: string;
    image?: string;
  } | null>(locationState?.firstPrompt ?? null);

  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");

  const previewEntryPath = useMemo(() => {
    if (files["/index.html"]) return "/index.html";
    if (files["index.html"]) return "index.html";
    const firstHtml = Object.keys(files).find((key) =>
      key.toLowerCase().endsWith(".html")
    );
    return firstHtml || null;
  }, [files]);

  const previewHtml = useMemo(() => {
    if (!previewEntryPath)
      return `<html><body><p>${t("pages.novidade.errors.noHtmlGenerated")}</p></body></html>`;
    const entry = files[previewEntryPath] || files[`/${previewEntryPath}`];
    if (!entry)
      return `<html><body><p>${t("pages.novidade.errors.noHtmlGenerated")}</p></body></html>`;
    return inlineAssets(
      entry,
      files,
      previewEntryPath.startsWith("/") ? previewEntryPath : `/${previewEntryPath}`
    );
  }, [files, previewEntryPath, t]);

  const previewKey = useMemo(() => {
    const head = previewHtml.slice(0, 180);
    let hash = 0;
    for (let i = 0; i < head.length; i += 1) {
      hash = (hash * 31 + head.charCodeAt(i)) | 0;
    }
    return `${previewRevision}-${Object.keys(files).length}-${previewHtml.length}-${Math.abs(hash)}`;
  }, [files, previewHtml, previewRevision]);

  const latestSnapshot = snapshots[0] ?? null;
  const hasContent = previewEntryPath !== null;

  // Intercept in-iframe link clicks
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
        if (!clickable || clickable.tagName.toLowerCase() !== "a") return;
        const anchor = clickable as HTMLAnchorElement;
        const href = (anchor.getAttribute("href") || "").trim();
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
        event.preventDefault();
      };
      doc.addEventListener("click", clickHandler, true);
    };
    iframe.addEventListener("load", handleLoad);
    return () => { iframe.removeEventListener("load", handleLoad); };
  }, [previewKey]);

  const skipNextProjectLoadRef = useRef(false);

  const navigateToWorkspace = (nextProjectId: string | null, replace = true) => {
    const params = new URLSearchParams();
    if (nextProjectId) params.set("project", nextProjectId);
    const query = params.toString();
    navigate(`/site${query ? `?${query}` : ""}`, { replace });
  };

  // Redirect /novidade?project=xxx → /site?project=xxx
  useEffect(() => {
    if (isWorkspaceRoute) return;
    if (!routeProjectId) return;
    const params = new URLSearchParams();
    params.set("project", routeProjectId);
    navigate(`/site?${params.toString()}`, { replace: true });
  }, [isWorkspaceRoute, navigate, routeProjectId]);

  // Load project on workspace entry — skip when we just created the project ourselves
  useEffect(() => {
    if (!isWorkspaceRoute || !routeProjectId) return;
    if (skipNextProjectLoadRef.current) {
      skipNextProjectLoadRef.current = false;
      return;
    }
    let cancelled = false;
    const loadProject = async () => {
      setLoadingProject(true);
      setError(null);
      try {
        const project = await getNovidadeProject(routeProjectId);
        if (cancelled) return;
        const normalizedFiles = Object.entries(project.files || {}).reduce<
          Record<string, string>
        >((acc, [key, value]) => {
          const normalized = key.startsWith("/") ? key : `/${key}`;
          acc[normalized] = value;
          return acc;
        }, {});
        if (Object.keys(normalizedFiles).length > 0) setFiles(normalizedFiles);
        setInitialMessages(project.messages || []);
        setProjectId(project.projectId || routeProjectId);
        setChatPanelKey(`novidade-chat-${project.projectId || routeProjectId}`);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : t("pages.novidade.errors.loadProject"));
      } finally {
        if (!cancelled) setLoadingProject(false);
      }
    };
    void loadProject();
    return () => { cancelled = true; };
  }, [isWorkspaceRoute, routeProjectId, setFiles, t]);

  // Load snapshots
  useEffect(() => {
    if (!projectId) { setSnapshots([]); return; }
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
    return () => { cancelled = true; };
  }, [projectId]);

  // Poll publish job
  useEffect(() => {
    if (!publishJobId) return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const stop = () => { if (intervalId !== undefined) clearInterval(intervalId); };
    const poll = async () => {
      if (cancelled) return;
      try {
        const job = await getPublishJobStatus(publishJobId);
        if (cancelled) return;
        if (job.status === "success") {
          stop();
          setPublishing(false);
          setPublishJobId(null);
          const result = (job.result || {}) as Record<string, unknown>;
          const siteUrl = typeof result.siteUrl === "string" ? result.siteUrl : null;
          setPublicSiteUrl(siteUrl);
        } else if (job.status === "failed") {
          stop();
          setPublishing(false);
          setPublishJobId(null);
          setError(job.error || t("pages.novidade.errors.publishFailed"));
        } else {
          setPublishing(true);
        }
      } catch (e) {
        if (!cancelled) {
          setPublishing(false);
          setError(
            e instanceof Error ? e.message : t("pages.novidade.errors.publishStatus")
          );
          stop();
        }
      }
    };
    void poll();
    intervalId = setInterval(() => void poll(), 3000);
    return () => { cancelled = true; stop(); };
  }, [publishJobId, t]);

  // ── Actions ──────────────────────────────────────────────────────────────
  function slugValid(s: string) {
    const n = s.trim().toLowerCase();
    if (!n || n.length > 63) return false;
    return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(n);
  }

  function slugOk(s: string): boolean {
    return slugValid(s) && !_novSlugReserved(s);
  }

  const handlePublish = async (slugOverride?: string) => {
    if (!usuario?.id) { setError(t("pages.novidade.errors.authRequired")); return; }
    const slug = (slugOverride ?? publishSlug).trim();
    if (slug && _novSlugReserved(slug)) {
      setError(t("pages.criarSite.errors.slugReserved"));
      return;
    }
    if (slug && !slugValid(slug)) {
      setError(t("pages.criarSite.errors.slugInvalid"));
      return;
    }
    try {
      setError(null);
      setPublishing(true);
      setShowDeployDialog(false);
      const payloadFiles = Object.entries(files).map(([path, content]) => ({
        path: path.replace(/^\//, ""),
        content: content as string,
      }));
      const res = await postPublish({
        userId: usuario.id,
        projectId,
        files: payloadFiles,
        slug: slug || undefined,
      });
      setPublishJobId(res.jobId);
    } catch (e) {
      setPublishing(false);
      setError(e instanceof Error ? e.message : t("pages.novidade.errors.publish"));
    }
  };

  /** Opens the current previewHtml as a blob URL in a new browser tab */
  const handleOpenPreview = () => {
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    // Revoke after 60 s — the tab has already received the content by then
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    if (!win) setError(t("pages.novidade.errors.popupBlocked"));
  };

  const previewHost =
    typeof window !== "undefined" ? window.location.host : "laurenastudio.pro";
  const userInitial = (usuario?.nome?.trim()?.[0] || "e").toUpperCase();

  const handleLandingSend = (message: {
    content: { text: string; image: string };
  }) => {
    const text = message.content.text.trim();
    if (!text) return;
    resetFilesToDefault();
    setInitialMessages([]);
    setChatPanelKey(`novidade-chat-new-${Date.now()}`);
    setProjectId(null);
    setSnapshots([]);
    setPublicSiteUrl(null);
    setError(null);
    setLandingPrompt("");
    // Navigate to /site carrying the first prompt in location.state.
    // This survives the component remount caused by the route switch
    // (/novidade Route → /site Route), because React Router preserves
    // history-entry state when mounting the incoming route's component.
    navigate("/site", {
      state: { firstPrompt: { text, image: message.content.image || undefined } },
      replace: false,
    });
  };

  // ── LANDING (/novidade) ───────────────────────────────────────────────────
  if (!isWorkspaceRoute) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute top-1/3 -right-24 h-[400px] w-[400px] rounded-full bg-primary/8 blur-[100px]" />
        </div>

        <header className="relative z-10 mx-auto flex w-full max-w-[1280px] items-center justify-between px-4 py-4 sm:px-6 md:py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <LaurenaBuilderLogo width={18} height={18} fill="white" />
            </div>
            <span className="text-[18px] font-semibold leading-none tracking-[-0.02em] text-foreground sm:text-[20px]">
              Laurena Builder
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <button
              type="button"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              {t("pages.novidade.landing.support")}
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
              {userInitial}
            </div>
          </div>
        </header>

        <section className="relative z-10 mx-auto flex w-full max-w-[960px] flex-col items-center px-4 pb-16 pt-10 text-center sm:px-6 md:pt-16 lg:pt-20">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary animate-fade-in">
            <Sparkles className="h-3 w-3" />
            {t("pages.novidade.landing.badge")}
          </div>

          <h1 className="max-w-3xl text-balance text-[34px] font-bold leading-[1.15] tracking-[-0.025em] text-foreground animate-slide-up sm:text-[44px] md:text-[56px] lg:text-[64px]">
            {t("pages.novidade.landing.titleBefore")}{" "}
            <span className="text-gradient">{t("pages.novidade.landing.titleHighlight")}</span>
          </h1>

          <p className="mt-4 max-w-[680px] text-balance text-[16px] leading-[1.6] text-muted-foreground animate-slide-up stagger-1 sm:text-[18px] md:text-[20px]">
            {t("pages.novidade.landing.subtitle")}
          </p>

          <div className="mt-8 w-full max-w-[760px] animate-scale-in stagger-2">
            <div className="rounded-2xl border border-primary/20 bg-card shadow-[0_8px_32px_rgba(193,95,60,0.12)] transition-shadow duration-300 hover:shadow-[0_12px_40px_rgba(193,95,60,0.18)]">
              <div className="p-2 sm:p-3">
                <PromptInput
                  onSendMessage={handleLandingSend}
                  input={landingPrompt}
                  setInput={setLandingPrompt}
                  handleInputChange={(e) => setLandingPrompt(e.target.value)}
                  onError={(msg) => setError(msg)}
                  height={82}
                  variant="landing"
                  placeholder={t("pages.novidade.landing.promptPlaceholder")}
                />
              </div>
            </div>
            {error && (
              <p className="mt-2 text-center text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 animate-fade-in stagger-3">
            {[
              t("pages.novidade.landing.pills.livePreview"),
              t("pages.novidade.landing.pills.oneClickDeploy"),
              t("pages.novidade.landing.pills.models"),
              t("pages.novidade.landing.pills.snapshots"),
            ].map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {pill}
              </span>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // ── WORKSPACE (/novidade/workspace) ──────────────────────────────────────
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background">

      {/* ── Desktop top bar ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-card/80 px-3 py-2 backdrop-blur-sm sm:px-4">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.removeItem("novidade_pub_job");
                sessionStorage.removeItem("novidade_site_url");
              } catch { /* ignore */ }
              navigate("/novidade");
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t("pages.novidade.workspace.backAria")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LaurenaBuilderLogo width={13} height={13} fill="white" />
          </div>
          <span className="hidden truncate text-sm font-semibold text-foreground sm:block">
            Laurena Builder
          </span>
          {projectId && (
            <span className="hidden truncate text-xs text-muted-foreground md:block">
              · {projectId.slice(0, 8)}…
            </span>
          )}
        </div>

        {/* Desktop action buttons */}
        <div className="hidden items-center gap-2 md:flex">
          {publicSiteUrl && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => window.open(publicSiteUrl, "_blank")}
            >
              <ExternalLink className="h-3 w-3" />
              {t("pages.novidade.workspace.viewPublishedSite")}
            </Button>
          )}

          {/* Preview — opens blob in new tab */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-semibold"
            onClick={handleOpenPreview}
            disabled={!hasContent}
            title={t("pages.novidade.workspace.previewTitle")}
          >
            <Eye className="h-3 w-3" />
            {t("pages.novidade.workspace.previewButton")}
          </Button>

          {/* Deploy — opens slug dialog first */}
          <Button
            size="sm"
            className="h-8 gap-1.5 px-3 text-xs font-semibold"
            onClick={() => setShowDeployDialog(true)}
            disabled={publishing || !hasContent}
            title={t("pages.novidade.workspace.deployTitle")}
          >
            {publishing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Rocket className="h-3 w-3" />
            )}
            {publishing ? t("pages.novidade.workspace.deploying") : t("pages.novidade.workspace.deployButton")}
          </Button>
        </div>
      </header>

      {/* ── Mobile bottom nav (3 tabs) ── */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-card/95 backdrop-blur-sm md:hidden">
        {(
          [
            { id: "chat",     Icon: MessageSquare, label: t("pages.novidade.workspace.tabs.chat") },
            { id: "preview",  Icon: Monitor,       label: t("pages.novidade.workspace.tabs.preview") },
            { id: "publicar", Icon: Rocket,        label: t("pages.novidade.workspace.tabs.publish") },
          ] as const
        ).map(({ id, Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobileTab(id)}
            className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
              mobileTab === id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {id === "publicar" && publishing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Icon className="h-5 w-5" />
            )}
            <span>{id === "publicar" && publishing ? t("pages.novidade.workspace.tabs.publishing") : label}</span>
          </button>
        ))}
      </div>

      {/* ── Main split layout ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden pb-[52px] md:pb-0">

        {/* ── Chat panel ── */}
        <section
          className={`flex flex-col border-border bg-card/50 ${
            mobileTab === "chat" ? "flex" : "hidden"
          } w-full md:flex md:w-[380px] md:shrink-0 md:border-r lg:w-[420px] xl:w-[450px]`}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("pages.novidade.workspace.label")}
              </p>
              <h2 className="text-sm font-semibold text-foreground">
                Laurena Builder
              </h2>
            </div>
            <div
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                projectId
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {projectId ? t("pages.novidade.workspace.statusConnected") : t("pages.novidade.workspace.statusNewSession")}
            </div>
          </div>

          {snapshots.length > 0 && (
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/30 px-4 py-1.5 text-[11px] text-muted-foreground">
              <span>
                {t("pages.novidade.workspace.snapshotsCount", { count: snapshots.length })}
              </span>
              {latestSnapshot && (
                <span className="truncate pl-2">
                  {new Date(latestSnapshot.createdAt).toLocaleTimeString(i18n.language || undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          )}

          <div className="min-h-0 flex-1 p-3">
            {loadingProject ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-border bg-background/50">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("pages.novidade.workspace.loadingProject")}
                  </p>
                </div>
              </div>
            ) : (
              <ChatPanel
                key={chatPanelKey}
                initialMessages={initialMessages}
                initialProjectId={projectId}
                onProjectIdChange={(id) => {
                  skipNextProjectLoadRef.current = true;
                  setProjectId(id);
                  navigateToWorkspace(id, true);
                  setMobileTab("preview");
                }}
                autoSendText={queuedFirstPrompt?.text || null}
                autoSendImage={queuedFirstPrompt?.image || null}
                onAutoSendConsumed={() => setQueuedFirstPrompt(null)}
              />
            )}
          </div>
        </section>

        {/* ── Preview panel ── */}
        <section
          className={`flex flex-col bg-muted/20 ${
            mobileTab === "preview" ? "flex" : "hidden"
          } w-full min-w-0 flex-1 md:flex`}
        >
          <div className="min-h-0 flex-1 p-2 sm:p-3">
            <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <PreviewToolbar
                host={previewHost}
                onRefresh={() => setPreviewRevision((n) => n + 1)}
              />
              <iframe
                ref={previewIframeRef}
                key={previewKey}
                title={t("pages.novidade.workspace.previewIframeTitle")}
                srcDoc={previewHtml}
                className="h-full w-full flex-1 border-0"
                sandbox="allow-scripts allow-forms allow-same-origin"
              />
            </div>
          </div>

          {/* Status bar + mobile Preview button */}
          <div className="flex shrink-0 items-center justify-between border-t border-border bg-card/60 px-4 py-1.5">
            <span className="text-[11px] text-muted-foreground">
              {latestSnapshot
                ? t("pages.novidade.workspace.snapshotLabel", { hash: latestSnapshot.commitHash.slice(0, 7) })
                : t("pages.novidade.workspace.noSnapshots")}
            </span>
            {/* Mobile-only: open in browser */}
            <button
              type="button"
              onClick={handleOpenPreview}
              disabled={!hasContent}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/8 disabled:opacity-40 md:hidden"
            >
              <ExternalLink className="h-3 w-3" />
              {t("pages.novidade.workspace.openInBrowser")}
            </button>
          </div>

          {error && (
            <div className="shrink-0 border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </section>

        {/* ── Publicar panel (mobile only — visible when mobileTab = publicar) ── */}
        {mobileTab === "publicar" && (
          <section className="flex w-full flex-col items-center justify-center gap-6 p-6 md:hidden">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Rocket className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold text-foreground">{t("pages.novidade.workspace.deployPanelTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("pages.novidade.workspace.deployPanelDescription")}
              </p>
            </div>

            {publicSiteUrl ? (
              <div className="w-full max-w-sm rounded-xl border border-green-500/20 bg-green-500/8 p-4 text-center">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-600">
                  {t("pages.novidade.workspace.sitePublished")}
                </p>
                <a
                  href={publicSiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-sm font-medium text-green-700 underline"
                >
                  {publicSiteUrl}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : (
              <Button
                size="lg"
                className="w-full max-w-sm gap-2 font-semibold"
                onClick={() => setShowDeployDialog(true)}
                disabled={publishing || !hasContent}
              >
                {publishing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{t("pages.novidade.workspace.tabs.publishing")}</>
                ) : (
                  <><Rocket className="h-4 w-4" />{t("pages.novidade.workspace.publishNow")}</>
                )}
              </Button>
            )}

            {error && (
              <p className="max-w-sm text-center text-sm text-destructive">{error}</p>
            )}
          </section>
        )}
      </div>

      {/* ── Deploy Dialog — slug input before publish ── */}
      <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" />
              {t("pages.novidade.dialog.title")}
            </DialogTitle>
            <DialogDescription>
              {t("pages.novidade.dialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="deploy-slug">{t("pages.novidade.dialog.subdomain")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="deploy-slug"
                  placeholder={t("pages.novidade.dialog.slugPlaceholder")}
                  value={publishSlug}
                  onChange={(e) =>
                    setPublishSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                  }
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && slugOk(publishSlug)) {
                      void handlePublish(publishSlug);
                    }
                  }}
                />
                <span className="shrink-0 text-sm text-muted-foreground">.laurenastudio.pro</span>
              </div>
              {publishSlug && _novSlugReserved(publishSlug) && (
                <p className="text-xs text-destructive">
                  {t("pages.criarSite.errors.slugReserved")}
                </p>
              )}
              {publishSlug && !_novSlugReserved(publishSlug) && !slugValid(publishSlug) && (
                <p className="text-xs text-destructive">
                  {t("pages.novidade.dialog.slugHint")}
                </p>
              )}
              {publishSlug && slugOk(publishSlug) && (
                <p className="text-xs text-green-600">
                  https://{publishSlug}.laurenastudio.pro
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDeployDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => void handlePublish(publishSlug)}
              disabled={!slugOk(publishSlug)}
              className="gap-2"
            >
              <Rocket className="h-4 w-4" />
              {t("pages.novidade.dialog.publish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
