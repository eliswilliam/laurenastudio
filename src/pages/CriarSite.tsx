import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Send,
  Loader2,
  Wand2,
  ExternalLink,
  Rocket,
  History,
  BrainCircuit,
  LayoutTemplate,
  Globe,
  Check,
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
const BOTAO_GERAR = 'Gerar site';
const BOTAO_PUBLICAR = 'Publicar';
const DICA_TECLADO = 'Enter envia · Shift+Enter nova linha';
const LOADING_TEXTO = 'Laurena está a pensar…';
const POLL_MS = 2500;

const FLOW_STEPS = [
  { n: 1, short: 'Briefing', Icon: BrainCircuit },
  { n: 2, short: 'Gerar', Icon: Wand2 },
  { n: 3, short: 'Preview', Icon: LayoutTemplate },
  { n: 4, short: 'Online', Icon: Globe },
] as const;

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

/** Desktop : colonne chat séparée de la prévia ; mobile : même colonne (messages puis iframe). */
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobilePublishOpen, setMobilePublishOpen] = useState(false);
  /** Projeto aberto pelo painel Histórico: sem novas mensagens para /sites/chat. */
  const [conversationReadOnly, setConversationReadOnly] = useState(false);
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
          });
        } else {
          setSiteResult(null);
        }
        setPublicSiteUrl(userFacingSiteUrl(s.publish_slug, s.site_url));
        setPublishSlug(s.publish_slug ?? '');
        setAGerar(false);
        setAPublicar(false);
        if (s.status === 'generating') {
          setAGerar(true);
          setPollProjectId(pid);
        } else {
          setPollProjectId(null);
        }
        setConversationReadOnly(true);
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
          setSiteResult({ previewUrl });
          setPublicSiteUrl(userFacingSiteUrl(s.publish_slug, s.site_url));
          setPublishSlug(s.publish_slug ?? '');
          setPollProjectId(null);
          setAGerar(false);
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
    setMobilePublishOpen(false);
    setConversationReadOnly(false);
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
        <div key={m.id} className="w-full min-w-0 flex flex-col pt-1">
          {m.papel === 'bot' ? (
            <div className="flex w-full min-w-0 justify-start">
              <div className="flex gap-3 max-w-[95%] md:max-w-2xl">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Wand2 className="h-4 w-4" />
                </div>
                <div className="rounded-2xl px-5 py-3.5 bg-muted/30 border border-border/50 text-foreground text-[15px] sm:text-base leading-[1.65]">
                  <p className="whitespace-pre-wrap">
                    {stripInfraFromBotText(m.texto)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex w-full min-w-0 justify-end">
              <div
                className={cn(
                  'max-w-[min(100%,32rem)] rounded-2xl px-5 py-3.5',
                  'bg-primary text-primary-foreground shadow-sm',
                  'text-[15px] sm:text-base leading-[1.65]'
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

  /** 1 = briefing · 2 = a gerar · 3 = pré-visualizar · 4 = site online */
  const flowStepActive = useMemo(() => {
    if (publicSiteUrl) return 4;
    if (siteResult?.previewUrl) return 3;
    if (aGerar || pollProjectId || generateJobId) return 2;
    return 1;
  }, [publicSiteUrl, siteResult, aGerar, pollProjectId, generateJobId]);

  useEffect(() => {
    if (publicSiteUrl) setMobilePublishOpen(false);
  }, [publicSiteUrl]);

  useEffect(() => {
    // block: 'end' — aligne le bas du fil (repère h-px) au bas du scrollport.
    // Sans cela, le défaut peut centrer le repère et faire « remonter » la dernière bulle.
    const opts: ScrollIntoViewOptions = { behavior: 'smooth', block: 'end', inline: 'nearest' };
    if (isWideLg) {
      fim.current?.scrollIntoView(opts);
    } else {
      fimMobile.current?.scrollIntoView(opts);
    }
  }, [lista, aEnviar, aGerar, aPublicar, isWideLg]);

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
          setSiteResult({ previewUrl });
          const pronto: Mensagem = {
            id: ID(),
            papel: 'bot',
            texto: String(
              r.message ??
                'Site gerado com sucesso! Use os botões abaixo para ver a pré-visualização.'
            ),
          };
          setLista((p) => [...p, pronto]);
          setAGerar(false);
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
            // Em vez de enviar para o chat, setamos um alerta se houver erro
            setErro('A publicação terminou com avisos. O URL público pode demorar alguns minutos.');
          }

          setAPublicar(false);
          clearPublishJob();
        } else if (j.status === 'failed') {
          finish();
          const msg = j.error || 'Erro ao publicar.';
          setErro(msg);
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
    if (conversationReadOnly) return;
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
      // Removed errMsg to avoid polluting chat history with system errors
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

    try {
      const { data } = await api.post<{ jobId: string; projectId: string; message: string }>(
        '/sites/generate',
        { project_id: projectId }
      );
      setGenerateJobId(data.jobId);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao gerar o site.';
      setErro(msg);
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
      setAPublicar(false);
    }
  }

  const mainChrome = (
    <>
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <div
          className={cn(
            'sticky z-20 -mx-3 px-3 sm:-mx-4 sm:px-4',
            'top-14 md:top-16',
            'bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85',
            'border-b border-border/50 shadow-sm'
          )}
        >
          <div className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0 space-y-0.5">
              <h1 className="text-lg font-semibold tracking-tight">{TITULO_PAGINA}</h1>
              <p className="text-xs text-muted-foreground leading-snug max-w-md hidden sm:block">
                Um fluxo único: conversar com a Laurena, gerar o site, ver o resultado e publicar.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {emConversa && projectId && (
                <Button
                  variant={siteResult ? 'outline' : 'default'}
                  size="sm"
                  className="h-9 rounded-md text-xs hidden sm:flex font-medium"
                  onClick={gerarSite}
                  disabled={aGerar || aPublicar || !projectId}
                >
                  {aGerar ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {BOTAO_GERAR}
                </Button>
              )}
              <SheetTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 h-9">
                  <History className="w-4 h-4" />
                  <span className="hidden min-[400px]:inline">Histórico</span>
                </Button>
              </SheetTrigger>
              <Button type="button" variant="secondary" size="sm" className="h-9" onClick={iniciarNovoSite}>
                Novo site
              </Button>
            </div>
          </div>

          <nav className="pb-3" aria-label="Progresso no criador de sites">
            <div className="flex items-center w-full max-w-3xl" role="list">
              {FLOW_STEPS.map(({ n, short, Icon }, idx) => {
                const done = flowStepActive > n;
                const active = flowStepActive === n;
                return (
                  <div key={n} className="flex items-center min-w-0 flex-1 sm:flex-initial" role="listitem">
                    <div
                      className={cn(
                        'flex items-center gap-1.5 min-w-0 flex-1 justify-center sm:justify-start',
                        idx === FLOW_STEPS.length - 1 && 'sm:flex-none'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                          done && 'border-primary bg-primary/10 text-primary',
                          active && !done && 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20',
                          !done && !active && 'border-muted bg-muted/30 text-muted-foreground'
                        )}
                        aria-current={active ? 'step' : undefined}
                      >
                        {done ? (
                          <Check className="w-4 h-4" strokeWidth={2.5} />
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                      </span>
                      <span
                        className={cn(
                          'hidden sm:inline text-xs truncate max-w-[5.5rem]',
                          active && 'font-medium text-foreground',
                          !active && 'text-muted-foreground'
                        )}
                      >
                        {short}
                      </span>
                    </div>
                    {idx < FLOW_STEPS.length - 1 && (
                      <div
                        className="hidden sm:block h-0.5 w-6 lg:w-10 shrink-0 rounded-full bg-border mx-0.5"
                        aria-hidden
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </nav>
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

      {publicSiteUrl && emConversa && (
        <div className="lg:col-span-2 order-first mb-1 lg:mb-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700/90 dark:text-emerald-400/90">
                Site no ar
              </p>
              <a
                href={publicSiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 underline-offset-4 hover:underline break-all"
              >
                {publicSiteUrl}
              </a>
            </div>
          </div>
        </div>
      )}

      <div className={cn('flex-1 flex flex-col min-h-0 lg:col-span-1', !emConversa && 'justify-center lg:col-span-2')}>
        {((generateJob?.logs?.length ?? 0) > 0 || (publishJob?.logs?.length ?? 0) > 0) && emConversa && (
          <details className="mb-3 shrink-0 rounded-lg border border-border/50 bg-muted/15 text-[11px] font-mono text-muted-foreground">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-sans text-foreground">
              Detalhes do processo (técnico)
            </summary>
            <div className="px-3 pb-2 max-h-28 overflow-y-auto space-y-0.5 border-t border-border/30 pt-2">
              {(generateJob?.logs ?? []).map((l, i) => (
                <div key={`g-${i}`}>{l.message}</div>
              ))}
              {(publishJob?.logs ?? []).map((l, i) => (
                <div key={`p-${i}`}>{l.message}</div>
              ))}
            </div>
          </details>
        )}

        {!emConversa ? (
          <div className="flex flex-col items-center justify-center px-3 sm:px-6 py-6 md:py-10">
            <div className="w-full max-w-xl text-center space-y-4 md:space-y-5 mb-8 md:mb-10">
              <p className="text-muted-foreground text-[15px] sm:text-base md:text-lg leading-relaxed text-balance">
                {MENSAGEM_ABERTURA_TEXTO}
              </p>
            </div>
          </div>
        ) : isWideLg ? (
          <div
            className={cn(
              'flex flex-1 flex-col overflow-y-auto min-h-0 pr-1 -mr-1 space-y-6 md:space-y-8',
              'pb-4 scroll-pb-2'
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
          <div className="flex flex-1 flex-col overflow-y-auto min-h-0 mt-0 gap-4 scroll-pb-2">
            <div className="space-y-6 md:space-y-8 pr-1 -mr-1 pb-2 w-full min-w-0">
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
            <div className="shrink-0 flex flex-col min-h-[min(50dvh,420px)] pb-2">
              {siteResult && previewAbsUrl ? (
                <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border/70 bg-muted/20 overflow-hidden shadow-sm">
                  <p className="text-xs font-medium text-muted-foreground px-3 py-2 border-b bg-background/90 shrink-0">
                    Pré-visualização no painel
                  </p>
                  <iframe
                    title="Pré-visualização do site gerado"
                    src={previewAbsUrl}
                    className="w-full flex-1 min-h-[260px] bg-white"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                  />
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 p-6 text-center text-sm text-muted-foreground min-h-[180px]">
                  Gere o site para ver a pré-visualização aqui.
                </div>
              )}
            </div>
          </div>
        )}

        {erro && (
          <div className="mx-auto mb-2 max-w-md rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive text-center">
            {erro}
          </div>
        )}

        {conversationReadOnly && emConversa && (
          <div className="mx-auto mb-3 max-w-xl rounded-lg border border-amber-500/35 bg-amber-500/[0.08] px-3 py-2.5 text-xs text-amber-950/90 dark:text-amber-100/90 leading-snug">
            <strong className="font-semibold">Projeto do histórico.</strong> A conversa com a Laurena está
            desativada neste projeto. Pode pré-visualizar, gerar de novo ou publicar. Para um novo briefing
            com a IA, use <strong>Novo site</strong>.
          </div>
        )}

        {/* Composeur — mobile : scroll (messages + prévia) puis cette zone fixe en bas de colonne */}
        <div className="shrink-0 pt-3 md:pt-4 pb-1 bg-gradient-to-t from-background via-background to-transparent">
            <div
              className={cn(
                'flex items-end gap-2 rounded-[1.35rem] border border-border/60',
                'bg-muted/25 dark:bg-muted/15 shadow-sm',
                'px-3 py-2.5 md:px-4 md:py-3',
                'transition-shadow duration-200',
                conversationReadOnly && 'opacity-60',
                !conversationReadOnly &&
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
                placeholder={
                  conversationReadOnly
                    ? 'Conversa bloqueada — abra «Novo site» para enviar mensagens à IA.'
                    : PLACEHOLDER_PROMPT
                }
                rows={1}
                disabled={conversationReadOnly || aEnviar || aGerar || aPublicar}
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
              disabled={
                conversationReadOnly || aEnviar || aGerar || aPublicar || !rascunho.trim()
              }
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
            {!conversationReadOnly && (
              <p className="text-center text-[11px] text-muted-foreground/80 mt-2.5 px-2">
                {DICA_TECLADO}
              </p>
            )}
          </div>
      </div>

      {emConversa && isWideLg && (
        <div className="flex flex-col min-h-0 min-w-0 lg:col-span-1 rounded-xl border border-border/80 bg-card/30 shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 p-3 border-b border-border/60 bg-muted/25 sm:flex-row sm:items-center sm:justify-between shrink-0">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight">Pré-visualização</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                HTML e CSS como no navegador
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {previewAbsUrl && (
                <Button variant="secondary" size="sm" className="h-9 rounded-full text-xs gap-1.5" asChild>
                  <a href={previewAbsUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir no separador
                  </a>
                </Button>
              )}
            </div>
          </div>
          {siteResult && previewAbsUrl ? (
            <iframe
              title="Pré-visualização do site gerado"
              src={previewAbsUrl}
              className="w-full flex-1 min-h-[min(55vh,560px)] bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground min-h-[240px] border border-dashed border-border/40 m-3 rounded-lg">
              <LayoutTemplate className="w-10 h-10 opacity-30 mb-3" />
              <p className="font-medium text-foreground">Ainda sem site gerado</p>
              <p className="mt-1 max-w-xs">
                Quando o briefing estiver claro, use «Gerar site» para ver o resultado aqui.
              </p>
            </div>
          )}
          {siteResult && (
            <div className="border-t border-border/60 p-3 space-y-2 bg-background/95 shrink-0">
              <p className="text-xs font-medium flex items-center gap-1.5 text-foreground">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                Publicar na internet
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1 min-w-0 space-y-1">
                  <label htmlFor="publish-slug-desktop" className="sr-only">
                    Subdomínio
                  </label>
                  <Input
                    id="publish-slug-desktop"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    placeholder="meu-site"
                    value={publishSlug}
                    onChange={(e) =>
                      setPublishSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    }
                    disabled={aPublicar}
                    className="h-9 rounded-lg text-xs"
                  />
                  {slugValid(publishSlug.trim()) && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      https://{publishSlug.trim().toLowerCase()}.{ROOT_DOMAIN}
                    </p>
                  )}
                </div>
                <Button
                  className="h-9 rounded-lg shrink-0"
                  onClick={publicar}
                  disabled={aPublicar || !usuario?.id}
                >
                  {aPublicar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                  {BOTAO_PUBLICAR}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {emConversa && !isWideLg && (
        <>
          <div
            className={cn(
              'fixed left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md',
              'px-3 py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]',
              'max-md:bottom-16 bottom-0 shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.12)]'
            )}
          >
            <div className="max-w-7xl mx-auto flex items-stretch justify-center gap-2 sm:gap-3">
              <Button
                variant={siteResult ? 'outline' : 'default'}
                size="sm"
                className="flex-1 sm:flex-none rounded-xl h-10 text-xs font-medium"
                onClick={gerarSite}
                disabled={aGerar || aPublicar || !projectId}
              >
                {aGerar ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                <span className="ml-1.5 hidden min-[360px]:inline">{BOTAO_GERAR}</span>
                <span className="ml-1.5 inline min-[360px]:hidden">Gerar</span>
              </Button>
              {previewAbsUrl && (
                <Button variant="secondary" size="sm" className="rounded-xl h-10 px-3 shrink-0" asChild>
                  <a href={previewAbsUrl} target="_blank" rel="noopener noreferrer" title="Abrir pré-visualização">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              )}
              {siteResult && (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 sm:flex-none rounded-xl h-10 text-xs font-medium"
                  onClick={() => setMobilePublishOpen(true)}
                  disabled={aPublicar}
                >
                  <Rocket className="w-4 h-4" />
                  <span className="ml-1.5">{BOTAO_PUBLICAR}</span>
                </Button>
              )}
            </div>
          </div>
          <Sheet open={mobilePublishOpen} onOpenChange={setMobilePublishOpen}>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[90dvh] flex flex-col">
              <SheetHeader className="text-left border-b border-border/50 pb-3">
                <SheetTitle>Publicar o site</SheetTitle>
                <SheetDescription>
                  Confirme o subdomínio e inicie a publicação. Pode acompanhar o progresso no feed acima.
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="publish-slug-mobile" className="text-xs font-medium">
                    Subdomínio {requirePublishSlug ? '(obrigatório)' : '(opcional)'}
                  </label>
                  <Input
                    id="publish-slug-mobile"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    placeholder="meu-site"
                    value={publishSlug}
                    onChange={(e) =>
                      setPublishSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    }
                    disabled={aPublicar}
                    className="h-11 rounded-xl"
                  />
                  {slugValid(publishSlug.trim()) && (
                    <p className="text-xs text-muted-foreground">
                      https://{publishSlug.trim().toLowerCase()}.{ROOT_DOMAIN}
                    </p>
                  )}
                </div>
                <Button
                  className="w-full h-11 rounded-xl gap-2"
                  onClick={() => {
                    void publicar();
                  }}
                  disabled={aPublicar || !usuario?.id}
                >
                  {aPublicar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  {BOTAO_PUBLICAR}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
      </div>
    </>
  );

  return (
    <div
      className={cn(
        'animate-fade-in w-full max-w-7xl mx-auto flex flex-col px-3 sm:px-4',
        'min-h-[calc(100dvh-8.5rem)] md:min-h-[calc(100dvh-7rem)]',
        emConversa && !isWideLg && 'max-md:pb-[10rem] md:pb-[5.75rem]',
        emConversa && !isWideLg && 'max-lg:-mx-0.5 max-lg:overflow-hidden'
      )}
    >
      {mainChrome}
    </div>
  );
}
