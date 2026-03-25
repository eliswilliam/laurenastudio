import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Send,
  Loader2,
  Wand2,
  Download,
  ExternalLink,
  Rocket,
  History,
  BrainCircuit,
  LayoutTemplate,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import api, { getJobStatus } from '@/lib/api';
import { type JobStatus, type Mensagem, MENSAGEM_ABERTURA_TEXTO } from '@/lib/criarSiteChat';
import { useAuthStore } from '@/store/useAuthStore';
import { useCriarSiteJobStore } from '@/store/useCriarSiteJobStore';
import { getPublishConfig, getPublishJobStatus, postPublish } from '@/lib/publishApi';
import {
  fetchSiteProjectsList,
  fetchSiteProjectStatus,
  type SiteProjectSummary,
} from '@/lib/siteProjectsApi';

const ID = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const ABERTURA: Mensagem = {
  id: '0',
  papel: 'bot',
  texto: MENSAGEM_ABERTURA_TEXTO,
};

export const SUGESTOES_CRIAR_SITE = [
  {
    titulo: 'Landing SaaS',
    prompt:
      'Landing para produto digital: hero com mockup, secção de benefícios, preços em 2 tiers e FAQ.',
  },
  {
    titulo: 'Restaurante',
    prompt:
      'Site para restaurante: carta/menu por categorias, reservas online, localização e horários.',
  },
  {
    titulo: 'Portfólio',
    prompt:
      'Portfólio de designer: galeria em grid, página sobre o autor e formulário de contacto minimalista.',
  },
] as const;

const PLACEHOLDER_PROMPT =
  'Descreva o site que imagina: sector, páginas, público, estética, referências…';
const LABEL_SUGESTOES = 'Ideias para começar';
const TITULO_PAGINA = 'Crie o seu site';
const SUBTITULO_FLUXO =
  'Converse com a Laurena para o briefing → Gerar site → pré-visualizar → ajustar na conversa e gerar de novo → Publicar.';
const BOTAO_GERAR = 'Gerar site';
const BOTAO_PUBLICAR = 'Publicar';
const DICA_TECLADO = 'Enter envia · Shift+Enter nova linha';
const LOADING_TEXTO = 'Laurena está a pensar…';
const POLL_MS = 2500;

/** Não listar no Histórico (conta) — título técnico da área de preview, não nome de projeto. */
const EXCLUDE_FROM_PROJECT_HISTORY_NAME = 'Pré-visualização (HTML + CSS como no navegador)';

const ROOT_DOMAIN =
  (import.meta.env.VITE_ROOT_DOMAIN as string | undefined)?.trim() || 'laurenastudio.pro';

function slugValid(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (!t || t.length > 63) return false;
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(t);
}

/** URL público apenas (subdomínio); não expõe GitHub nem Cloud Run. */
function userFacingSiteUrl(slug: string | null | undefined, siteUrl: string | null | undefined): string | null {
  const s = (slug ?? '').trim().toLowerCase();
  if (s && slugValid(s)) {
    return `https://${s}.${ROOT_DOMAIN}`;
  }
  const u = (siteUrl ?? '').trim();
  if (u && !/run\.app|github\.com/i.test(u)) {
    return u;
  }
  return null;
}

/** Remove linhas antigas com links técnicos do texto exibido no chat. */
function stripInfraFromBotText(text: string): string {
  return text
    .split('\n')
    .filter((line) => !/github\.com|\.run\.app|Cloud Run|GitHub|Actions \(ver|workflow GitHub/i.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Un seul panneau chat (mobile Tabs vs colonne desktop) pour éviter un double fil de messages. */
function useIsWideLg() {
  const [wide, setWide] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia('(min-width: 1024px)').matches;
    }
    return window.innerWidth >= 1024;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(min-width: 1024px)');
      const on = () => setWide(mq.matches);
      on();
      mq.addEventListener('change', on);
      return () => mq.removeEventListener('change', on);
    }
    const onResize = () => setWide(window.innerWidth >= 1024);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return wide;
}

export default function CriarSite() {
  const usuario = useAuthStore((s) => s.usuario);
  const generateJobId = useCriarSiteJobStore((s) => s.generateJobId);
  const publishJobId = useCriarSiteJobStore((s) => s.publishJobId);
  const setGenerateJobId = useCriarSiteJobStore((s) => s.setGenerateJobId);
  const setPublishJobId = useCriarSiteJobStore((s) => s.setPublishJobId);
  const clearGenerateJob = useCriarSiteJobStore((s) => s.clearGenerateJob);
  const clearPublishJob = useCriarSiteJobStore((s) => s.clearPublishJob);
  const resetAll = useCriarSiteJobStore((s) => s.resetAll);

  const lista = useCriarSiteJobStore((s) => s.lista);
  const setLista = useCriarSiteJobStore((s) => s.setLista);
  const [rascunho, setRascunho] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [aGerar, setAGerar] = useState(!!generateJobId);
  const [aPublicar, setAPublicar] = useState(!!publishJobId);
  const projectId = useCriarSiteJobStore((s) => s.projectId);
  const setProjectId = useCriarSiteJobStore((s) => s.setProjectId);
  const siteResult = useCriarSiteJobStore((s) => s.siteResult);
  const setSiteResult = useCriarSiteJobStore((s) => s.setSiteResult);
  const publicSiteUrl = useCriarSiteJobStore((s) => s.publicSiteUrl);
  const setPublicSiteUrl = useCriarSiteJobStore((s) => s.setPublicSiteUrl);
  const publishSlug = useCriarSiteJobStore((s) => s.publishSlug);
  const setPublishSlug = useCriarSiteJobStore((s) => s.setPublishSlug);
  /** Aligné sur GET /api/publish/config (Cloudflare actif côté API). */
  const [requirePublishSlug, setRequirePublishSlug] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [generateJob, setGenerateJob] = useState<JobStatus | null>(null);
  const [publishJob, setPublishJob] = useState<JobStatus | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const fimMobile = useRef<HTMLDivElement>(null);

  const [projects, setProjects] = useState<SiteProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [pollProjectId, setPollProjectId] = useState<string | null>(null);
  /** Pré-visualização + «Abrir no separador» só após gerar o site nesta sessão; oculto ao abrir o histórico. */
  const [showPreviewChrome, setShowPreviewChrome] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('chat');
  const isWideLg = useIsWideLg();

  const refreshProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const list = await fetchSiteProjectsList();
      setProjects(list);
    } catch {
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [projectId, refreshProjects]);

  const openProjectFromBackend = useCallback(
    async (pid: string) => {
      setSessionLoading(true);
      setErro(null);
      try {
        clearGenerateJob();
        clearPublishJob();
        const s = await fetchSiteProjectStatus(pid);
        const msgs: Mensagem[] = [ABERTURA];
        for (const p of s.prompts) {
          if (p.role !== 'user' && p.role !== 'assistant') continue;
          msgs.push({
            id: p.id,
            papel: p.role === 'user' ? 'user' : 'bot',
            texto: p.content,
          });
        }
        setLista(msgs);
        setProjectId(pid);
        if (s.preview_url) {
          setSiteResult({
            previewUrl: s.preview_url,
            downloadUrl: s.download_url ?? `/api/v1/sites/${pid}/download`,
          });
        } else {
          setSiteResult(null);
        }
        setPublicSiteUrl(userFacingSiteUrl(s.publish_slug, s.site_url));
        setPublishSlug(s.publish_slug ?? '');
        setAGerar(false);
        setAPublicar(false);
        setShowPreviewChrome(false);
        if (s.status === 'generating') {
          setAGerar(true);
          setPollProjectId(pid);
        } else {
          setPollProjectId(null);
        }
      } catch (e: unknown) {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar o projeto.');
      } finally {
        setSessionLoading(false);
      }
    },
    [
      clearGenerateJob,
      clearPublishJob,
      setLista,
      setProjectId,
      setSiteResult,
      setPublicSiteUrl,
      setPublishSlug,
    ]
  );

  useEffect(() => {
    if (!pollProjectId) return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const finish = () => {
      if (intervalId !== undefined) clearInterval(intervalId);
    };

    const tick = async () => {
      if (cancelled) return;
      try {
        const s = await fetchSiteProjectStatus(pollProjectId);
        if (cancelled) return;
        if (s.status === 'ready' && s.preview_url) {
          finish();
          const previewUrl = s.preview_url;
          const downloadUrl = s.download_url ?? `/api/v1/sites/${pollProjectId}/download`;
          setSiteResult({ previewUrl, downloadUrl });
          setPublicSiteUrl(userFacingSiteUrl(s.publish_slug, s.site_url));
          setPublishSlug(s.publish_slug ?? '');
          setLista((prev) => {
            const marker = 'Site gerado com sucesso';
            if (prev.some((m) => m.texto.includes(marker))) return prev;
            return [
              ...prev,
              {
                id: ID(),
                papel: 'bot',
                texto:
                  'Site gerado com sucesso! Use os botões abaixo para ver a preview ou fazer download.',
              },
            ];
          });
          setPollProjectId(null);
          setAGerar(false);
          setShowPreviewChrome(true);
          void refreshProjects();
        } else if (s.status === 'error') {
          finish();
          const err = s.error_message || 'Erro na geração.';
          setErro(err);
          setLista((prev) => [
            ...prev,
            { id: ID(), papel: 'bot', texto: `Erro na geração: ${err}` },
          ]);
          setPollProjectId(null);
          setAGerar(false);
        }
      } catch {
        if (!cancelled) {
          finish();
          setPollProjectId(null);
          setAGerar(false);
        }
      }
    };

    void tick();
    intervalId = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      finish();
    };
  }, [pollProjectId, setLista, setSiteResult, setPublicSiteUrl, setPublishSlug, refreshProjects]);

  const iniciarNovoSite = () => {
    setPollProjectId(null);
    setShowPreviewChrome(false);
    setMobileTab('chat');
    resetAll();
  };

  const nUser = lista.filter((m) => m.papel === 'user').length;
  const emConversa = nUser > 0;

  const filteredProjects = useMemo(
    () => projects.filter((p) => p.name !== EXCLUDE_FROM_PROJECT_HISTORY_NAME),
    [projects]
  );

  const messageNodes = useMemo(
    () =>
      lista.map((m) => (
        <div key={m.id}>
          {m.papel === 'bot' ? (
            <div className="max-w-[95%] md:max-w-2xl">
              <p className="whitespace-pre-wrap text-[15px] sm:text-base leading-[1.65] text-foreground">
                {stripInfraFromBotText(m.texto)}
              </p>
            </div>
          ) : (
            <div className="flex justify-end">
              <div
                className={cn(
                  'max-w-[min(100%,32rem)] rounded-2xl px-4 py-3',
                  'bg-muted/80 dark:bg-muted/50 text-foreground',
                  'text-[15px] sm:text-base leading-relaxed'
                )}
              >
                <p className="whitespace-pre-wrap">{m.texto}</p>
              </div>
            </div>
          )}
        </div>
      )),
    [lista]
  );

  /** URL absoluta para iframe / links (proxy Vite em dev). */
  const previewAbsUrl = useMemo(() => {
    if (!siteResult?.previewUrl) return null;
    const u = siteResult.previewUrl;
    if (u.startsWith('http')) return u;
    return `${window.location.origin}${u.startsWith('/') ? '' : '/'}${u}`;
  }, [siteResult?.previewUrl]);

  useEffect(() => {
    if (isWideLg) {
      fim.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (mobileTab === 'chat') {
      fimMobile.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lista, aEnviar, aGerar, aPublicar, mobileTab, isWideLg]);

  useEffect(() => {
    getPublishConfig()
      .then((c) => setRequirePublishSlug(Boolean(c.requireSlug)))
      .catch(() => setRequirePublishSlug(false));
  }, []);

  useEffect(() => {
    if (!generateJobId) {
      setGenerateJob(null);
      return;
    }
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const finish = () => {
      if (intervalId !== undefined) clearInterval(intervalId);
    };

    const tick = async () => {
      if (cancelled) return;
      try {
        const j = await getJobStatus(generateJobId);
        if (cancelled) return;
        setGenerateJob(j);
        if (j.status === 'success' && j.result) {
          finish();
          const r = j.result;
          const previewUrl = String(r.previewUrl ?? '');
          const downloadUrl = String(r.downloadUrl ?? '');
          setSiteResult({ previewUrl, downloadUrl });
          const pronto: Mensagem = {
            id: ID(),
            papel: 'bot',
            texto: String(
              r.message ??
                'Site gerado com sucesso! Use os botões abaixo para ver a preview ou fazer download.'
            ),
          };
          setLista((p) => [...p, pronto]);
          setAGerar(false);
          setShowPreviewChrome(true);
          clearGenerateJob();
        } else if (j.status === 'failed') {
          finish();
          const msg = j.error || 'Erro ao gerar o site.';
          setErro(msg);
          const errMsg: Mensagem = {
            id: ID(),
            papel: 'bot',
            texto: `Erro na geração: ${msg}`,
          };
          setLista((p) => [...p, errMsg]);
          setAGerar(false);
          clearGenerateJob();
        }
      } catch (err: unknown) {
        if (cancelled) return;
        finish();
        const msg = err instanceof Error ? err.message : 'Erro ao consultar o estado da geração.';
        setErro(msg);
        setAGerar(false);
        clearGenerateJob();
      }
    };

    void tick();
    intervalId = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      finish();
    };
  }, [generateJobId, clearGenerateJob]);

  useEffect(() => {
    if (!publishJobId) {
      setPublishJob(null);
      return;
    }
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const finish = () => {
      if (intervalId !== undefined) clearInterval(intervalId);
    };

    const tick = async () => {
      if (cancelled) return;
      try {
        const j = await getPublishJobStatus(publishJobId);
        if (cancelled) return;
        setPublishJob(j);
        if (j.status === 'success' && j.result) {
          finish();
          const r = j.result as Record<string, unknown>;
          const site = String(r.siteUrl ?? '').trim() || null;
          const deployOk = Boolean(r.deployOk ?? r.success);
          const slug = publishSlug.trim().toLowerCase();
          const vis = userFacingSiteUrl(slug || null, site);
          setPublicSiteUrl(vis);

          let textoSucesso = '';
          if (deployOk && vis) {
            textoSucesso =
              `Publicação concluída! O seu site público: ${vis}\n\n` +
              'Pode levar até 45 minutos para o endereço ficar totalmente disponível. ' +
              'Enquanto isso, use a pré-visualização acima.';
          } else if (deployOk) {
            textoSucesso =
              'Publicação concluída! O seu site foi publicado. ' +
              'Pode levar até 45 minutos para o endereço personalizado ficar disponível — use a pré-visualização enquanto isso.';
          } else {
            textoSucesso =
              'A publicação terminou com avisos. Use a pré-visualização para validar o site; o URL público pode demorar alguns minutos.';
          }

          const msg: Mensagem = {
            id: ID(),
            papel: 'bot',
            texto: textoSucesso,
          };
          setLista((p) => [...p, msg]);
          setAPublicar(false);
          clearPublishJob();
        } else if (j.status === 'failed') {
          finish();
          const msg = j.error || 'Erro ao publicar.';
          setErro(msg);
          const bot: Mensagem = {
            id: ID(),
            papel: 'bot',
            texto: `Não foi possível publicar: ${msg}`,
          };
          setLista((p) => [...p, bot]);
          setAPublicar(false);
          clearPublishJob();
        }
      } catch (err: unknown) {
        if (cancelled) return;
        finish();
        const msg = err instanceof Error ? err.message : 'Erro ao consultar a publicação.';
        setErro(msg);
        setAPublicar(false);
        clearPublishJob();
      }
    };

    void tick();
    intervalId = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      finish();
    };
  }, [publishJobId, clearPublishJob, publishSlug, setPublicSiteUrl]);

  async function enviar() {
    const t = rascunho.trim();
    if (!t || aEnviar) return;

    const user: Mensagem = { id: ID(), papel: 'user', texto: t };
    setLista((p) => [...p, user]);
    setRascunho('');
    setAEnviar(true);
    setErro(null);

    const allMessages = [...lista.filter((m) => m.id !== '0'), user];
    const apiMessages = allMessages.map((m) => ({
      role: m.papel === 'user' ? 'user' : 'assistant',
      content: m.texto,
    }));

    try {
      const { data } = await api.post('/sites/chat', {
        project_id: projectId,
        messages: apiMessages,
      });

      if (!projectId && data.project_id) {
        setProjectId(data.project_id);
      }

      const bot: Mensagem = { id: ID(), papel: 'bot', texto: data.reply };
      setLista((p) => [...p, bot]);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao comunicar com a IA.';
      setErro(msg);
      const bot: Mensagem = {
        id: ID(),
        papel: 'bot',
        texto: `Desculpe, ocorreu um erro: ${msg}`,
      };
      setLista((p) => [...p, bot]);
    } finally {
      setAEnviar(false);
    }
  }

  async function gerarSite() {
    if (!projectId || aGerar) return;
    setAGerar(true);
    setErro(null);
    setSiteResult(null);
    setPublicSiteUrl(null);
    setPublishSlug('');
    setShowPreviewChrome(false);

    const gerando: Mensagem = {
      id: ID(),
      papel: 'bot',
      texto: 'A gerar o site com base no briefing. Isto pode demorar alguns segundos…',
    };
    setLista((p) => [...p, gerando]);

    try {
      const { data } = await api.post<{ jobId: string; projectId: string; message: string }>(
        '/sites/generate',
        { project_id: projectId }
      );
      setGenerateJobId(data.jobId);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao gerar o site.';
      setErro(msg);
      const errMsg: Mensagem = {
        id: ID(),
        papel: 'bot',
        texto: `Erro na geração: ${msg}`,
      };
      setLista((p) => [...p, errMsg]);
      setAGerar(false);
    }
  }

  async function publicar() {
    if (!projectId || !usuario?.id || aPublicar) return;
    setAPublicar(true);
    setErro(null);
    setPublicSiteUrl(null);

    const slug = publishSlug.trim().toLowerCase();
    if (requirePublishSlug && !slug) {
      setErro('Indique um subdomínio (slug) para publicar com o seu domínio personalizado.');
      setAPublicar(false);
      return;
    }
    if (slug && !slugValid(slug)) {
      setErro('Use apenas letras minúsculas, números e hífens (1 a 63 caracteres).');
      setAPublicar(false);
      return;
    }

    try {
      const data = await postPublish({
        userId: usuario.id,
        projectId,
        files: [],
        ...(slug ? { slug } : {}),
      });
      setPublishJobId(data.jobId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao publicar.';
      setErro(msg);
      const bot: Mensagem = {
        id: ID(),
        papel: 'bot',
        texto: `Não foi possível publicar: ${msg}`,
      };
      setLista((p) => [...p, bot]);
      setAPublicar(false);
    }
  }

  return (
    <div
      className={cn(
        'animate-fade-in w-full max-w-7xl mx-auto flex flex-col px-3 sm:px-4',
        'min-h-[calc(100dvh-8.5rem)] md:min-h-[calc(100dvh-7rem)]',
        emConversa && !isWideLg && 'pb-[5.75rem]'
      )}
    >
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between shrink-0 py-3 border-b border-border/50">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight">{TITULO_PAGINA}</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 max-w-3xl leading-snug">
              {SUBTITULO_FLUXO}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                <History className="w-4 h-4" />
                Histórico
              </Button>
            </SheetTrigger>
            <Button type="button" variant="ghost" size="sm" onClick={iniciarNovoSite}>
              Novo site
            </Button>
          </div>
        </div>
        <SheetContent side="left" className="w-[min(100vw,420px)] flex flex-col gap-3">
          <SheetHeader>
            <SheetTitle>Histórico de projetos</SheetTitle>
            <SheetDescription>Abra um projeto guardado na sua conta.</SheetDescription>
          </SheetHeader>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              iniciarNovoSite();
              setHistoryOpen(false);
            }}
          >
            + Novo site
          </Button>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
            {projectsLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                A carregar…
              </div>
            ) : filteredProjects.length === 0 ? (
              <p className="text-[11px] text-muted-foreground leading-snug">
                Os projetos aparecem aqui após a primeira mensagem.
              </p>
            ) : (
              filteredProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    void openProjectFromBackend(p.id);
                    setHistoryOpen(false);
                  }}
                  className={cn(
                    'w-full text-left rounded-lg px-2.5 py-2 text-xs transition-colors',
                    'hover:bg-muted/80 border border-transparent',
                    projectId === p.id && 'bg-muted/60 border-border/80'
                  )}
                >
                  <span className="font-medium line-clamp-2 text-foreground">{p.name}</span>
                  <span className="block text-[10px] text-muted-foreground mt-0.5">
                    {new Date(p.created_at).toLocaleString(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                    {p.has_site ? ' · com site' : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <nav
        className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground overflow-x-auto py-2.5 shrink-0 border-b border-border/30"
        aria-label="Fluxo do criador de sites"
      >
        <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
          <BrainCircuit className="w-3.5 h-3.5" /> Briefing (IA)
        </span>
        <span aria-hidden>→</span>
        <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
          <Wand2 className="w-3.5 h-3.5" /> Gerar
        </span>
        <span aria-hidden>→</span>
        <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
          <LayoutTemplate className="w-3.5 h-3.5" /> Pré-visualizar
        </span>
        <span aria-hidden>→</span>
        <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
          <Globe className="w-3.5 h-3.5" /> Publicar
        </span>
      </nav>

      <div
        className={cn(
          'flex flex-col flex-1 min-w-0 w-full relative lg:grid lg:grid-cols-2 lg:gap-4 lg:items-stretch lg:min-h-0',
          sessionLoading && 'opacity-55 pointer-events-none'
        )}
      >
      {sessionLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 rounded-lg">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
      {emConversa && isWideLg && (
        <div className="lg:col-span-2 flex flex-wrap items-center justify-end gap-2 shrink-0 pb-3 border-b border-border/40 mb-3">
          {siteResult && (
            <>
              {showPreviewChrome && previewAbsUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-full h-9 gap-1.5 text-xs font-normal border-border/80"
                  asChild
                >
                  <a href={previewAbsUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                    Abrir no separador
                  </a>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 rounded-full h-9 gap-1.5 text-xs font-normal border-border/80"
                asChild
              >
                <a href={siteResult.downloadUrl}>
                  <Download className="w-3.5 h-3.5 opacity-70" />
                  Download
                </a>
              </Button>
              <div className="flex flex-col gap-1.5 min-w-0 sm:min-w-[11rem]">
                <label htmlFor="publish-slug" className="sr-only">
                  Subdomínio do site
                </label>
                <Input
                  id="publish-slug"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  placeholder="meu-site"
                  value={publishSlug}
                  onChange={(e) =>
                    setPublishSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                  }
                  disabled={aPublicar}
                  className="h-9 rounded-full text-xs border-border/80 bg-background/90"
                />
                {slugValid(publishSlug.trim()) && (
                  <p className="text-[10px] text-muted-foreground truncate px-0.5">
                    https://{publishSlug.trim().toLowerCase()}.{ROOT_DOMAIN}
                  </p>
                )}
              </div>
              <Button
                variant="default"
                size="sm"
                className="shrink-0 rounded-full h-9 gap-1.5 text-xs font-medium"
                onClick={publicar}
                disabled={aPublicar || !usuario?.id}
              >
                {aPublicar ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Rocket className="w-3.5 h-3.5" />
                )}
                {BOTAO_PUBLICAR}
              </Button>
            </>
          )}
          <Button
            variant={siteResult ? 'ghost' : 'default'}
            size="sm"
            className="shrink-0 rounded-full h-9 gap-1.5 text-xs font-medium"
            onClick={gerarSite}
            disabled={aGerar || aPublicar || !projectId}
          >
            {aGerar ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            {BOTAO_GERAR}
          </Button>
        </div>
      )}

      <div className={cn('flex-1 flex flex-col min-h-0 lg:col-span-1', !emConversa && 'justify-center lg:col-span-2')}>
        {((generateJob?.logs?.length ?? 0) > 0 || (publishJob?.logs?.length ?? 0) > 0) && emConversa && (
          <div className="mb-3 shrink-0 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 max-h-32 overflow-y-auto text-[11px] font-mono text-muted-foreground space-y-0.5">
            {(generateJob?.logs ?? []).map((l, i) => (
              <div key={`g-${i}`}>{l.message}</div>
            ))}
            {(publishJob?.logs ?? []).map((l, i) => (
              <div key={`p-${i}`}>{l.message}</div>
            ))}
          </div>
        )}

        {publicSiteUrl && emConversa && (
          <div className="mb-3 shrink-0 space-y-2">
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-center">
              <p className="text-xs text-muted-foreground">O seu site</p>
              <a
                href={publicSiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-emerald-700 dark:text-emerald-400 underline-offset-4 hover:underline break-all"
              >
                {publicSiteUrl}
              </a>
            </div>
          </div>
        )}

        {!emConversa ? (
          <div className="flex flex-col items-center justify-center px-3 sm:px-6 py-6 md:py-10">
            <div className="w-full max-w-xl text-center space-y-4 md:space-y-5 mb-8 md:mb-10">
              <p className="text-muted-foreground text-[15px] sm:text-base md:text-lg leading-relaxed text-balance">
                {MENSAGEM_ABERTURA_TEXTO}
              </p>
            </div>

            <div className="w-full max-w-3xl space-y-3">
              <p className="text-center text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
                {LABEL_SUGESTOES}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                {SUGESTOES_CRIAR_SITE.map((item) => (
                  <button
                    key={item.titulo}
                    type="button"
                    onClick={() => setRascunho(item.prompt)}
                    className={cn(
                      'text-left rounded-2xl border border-border/70 bg-background',
                      'px-4 py-3.5 shadow-sm transition-colors duration-150',
                      'hover:bg-muted/40 hover:border-border',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      'focus-visible:ring-offset-background'
                    )}
                  >
                    <span className="block text-sm font-medium text-foreground">{item.titulo}</span>
                    <span className="mt-1 block text-xs text-muted-foreground leading-snug line-clamp-2">
                      {item.prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : isWideLg ? (
          <div
            className={cn(
              'flex flex-1 flex-col overflow-y-auto min-h-0 pr-1 -mr-1 space-y-6 md:space-y-8',
              'pb-4'
            )}
          >
            {messageNodes}
            {(aEnviar || aGerar || aPublicar) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin shrink-0 opacity-70" />
                {aPublicar
                  ? 'A publicar em segundo plano. Pode fechar esta página — o progresso continua.'
                  : aGerar
                    ? 'A gerar o site em segundo plano. Pode fechar esta página — o progresso continua.'
                    : LOADING_TEXTO}
              </div>
            )}
            <div ref={fim} className="h-px" />
          </div>
        ) : (
          <Tabs
            value={mobileTab}
            onValueChange={(v) => setMobileTab(v as 'chat' | 'preview')}
            className="flex flex-1 flex-col min-h-0 min-w-0 -mx-0.5"
          >
            <TabsList className="grid w-full grid-cols-2 shrink-0 mb-2 h-9">
              <TabsTrigger value="chat" className="text-xs">
                Conversa
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs">
                Pré-visualização
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="chat"
              className="flex-1 overflow-y-auto min-h-0 mt-0 data-[state=inactive]:hidden flex flex-col"
            >
              <div className="space-y-6 md:space-y-8 pr-1 -mr-1 pb-4 flex-1">
                {messageNodes}
                {(aEnviar || aGerar || aPublicar) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0 opacity-70" />
                    {aPublicar
                      ? 'A publicar em segundo plano. Pode fechar esta página — o progresso continua.'
                      : aGerar
                        ? 'A gerar o site em segundo plano. Pode fechar esta página — o progresso continua.'
                        : LOADING_TEXTO}
                  </div>
                )}
                <div ref={fimMobile} className="h-px" />
              </div>
            </TabsContent>
            <TabsContent
              value="preview"
              className="flex-1 min-h-[min(60dvh,520px)] mt-0 flex flex-col data-[state=inactive]:hidden"
            >
              {siteResult && previewAbsUrl && showPreviewChrome ? (
                <div className="flex flex-col flex-1 min-h-0 rounded-xl border bg-muted/30 overflow-hidden">
                  <p className="text-xs font-medium text-muted-foreground px-3 py-2 border-b bg-background/80 shrink-0">
                    Pré-visualização (HTML + CSS como no navegador)
                  </p>
                  <iframe
                    title="Pré-visualização do site gerado"
                    src={previewAbsUrl}
                    className="w-full flex-1 min-h-[280px] bg-white"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                  />
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 p-6 text-center text-sm text-muted-foreground min-h-[200px]">
                  Gere o site para ver a pré-visualização aqui.
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {erro && (
          <div className="mx-auto mb-2 max-w-md rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive text-center">
            {erro}
          </div>
        )}

        <div className="shrink-0 pt-3 md:pt-4 pb-1 bg-gradient-to-t from-background via-background to-transparent">
          <div
            className={cn(
              'flex items-end gap-2 rounded-[1.35rem] border border-border/60',
              'bg-muted/25 dark:bg-muted/15 shadow-sm',
              'px-3 py-2.5 md:px-4 md:py-3',
              'transition-shadow duration-200',
              'focus-within:border-border focus-within:shadow-md focus-within:bg-muted/35 dark:focus-within:bg-muted/20'
            )}
          >
            <Textarea
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              placeholder={PLACEHOLDER_PROMPT}
              rows={1}
              disabled={aEnviar || aGerar || aPublicar}
              aria-label="Prompt para descrever o site"
              className={cn(
                'min-h-[44px] max-h-[200px] resize-none flex-1 border-0 bg-transparent p-1.5 md:p-2',
                'text-[15px] leading-relaxed shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
                'placeholder:text-muted-foreground/55'
              )}
            />
            <Button
              type="button"
              size="icon"
              disabled={aEnviar || aGerar || aPublicar || !rascunho.trim()}
              onClick={enviar}
              aria-label="Enviar mensagem"
              className={cn(
                'shrink-0 h-9 w-9 rounded-full mb-0.5',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:opacity-40'
              )}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground/80 mt-2.5 px-2">
            {DICA_TECLADO}
          </p>
        </div>
      </div>

      {emConversa && isWideLg && (
        <div className="flex flex-col min-h-0 min-w-0 rounded-xl border bg-muted/30 overflow-hidden">
          <p className="text-xs font-medium text-muted-foreground px-3 py-2 border-b bg-background/80 shrink-0">
            Pré-visualização (HTML + CSS como no navegador)
          </p>
          {siteResult && previewAbsUrl && showPreviewChrome ? (
            <iframe
              title="Pré-visualização do site gerado"
              src={previewAbsUrl}
              className="w-full flex-1 min-h-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground min-h-[200px]">
              Gere o site para ver a pré-visualização aqui.
            </div>
          )}
        </div>
      )}

      {emConversa && !isWideLg && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/60 bg-background/95 backdrop-blur-md px-3 py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-end gap-2">
            {siteResult && (
              <>
                {showPreviewChrome && previewAbsUrl && (
                  <Button variant="outline" size="sm" className="rounded-full h-9 text-xs shrink-0" asChild>
                    <a href={previewAbsUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                      Abrir
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" className="rounded-full h-9 text-xs shrink-0" asChild>
                  <a href={siteResult.downloadUrl}>
                    <Download className="w-3.5 h-3.5 opacity-70" />
                    ZIP
                  </a>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="rounded-full h-9 text-xs shrink-0"
                  onClick={publicar}
                  disabled={aPublicar || !usuario?.id}
                >
                  {aPublicar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                  {BOTAO_PUBLICAR}
                </Button>
              </>
            )}
            <Button
              variant={siteResult ? 'outline' : 'default'}
              size="sm"
              className="rounded-full h-9 text-xs font-medium shrink-0"
              onClick={gerarSite}
              disabled={aGerar || aPublicar || !projectId}
            >
              {aGerar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {BOTAO_GERAR}
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
