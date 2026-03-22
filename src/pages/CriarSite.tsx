import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Loader2, Wand2, Download, ExternalLink, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import api, { getJobStatus } from '@/lib/api';
import { type JobStatus, type Mensagem, MENSAGEM_ABERTURA_TEXTO } from '@/lib/criarSiteChat';
import { HistoricoSitesDrawer } from '@/components/HistoricoSitesDrawer';
import { useAuthStore } from '@/store/useAuthStore';
import { useCriarSiteJobStore, type SiteResult } from '@/store/useCriarSiteJobStore';
import { getPublishConfig, getPublishJobStatus, postPublish } from '@/lib/publishApi';

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

const ROOT_DOMAIN =
  (import.meta.env.VITE_ROOT_DOMAIN as string | undefined)?.trim() || 'laurenastudio.pro';

function slugValid(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (!t || t.length > 63) return false;
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(t);
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
  const githubUrl = useCriarSiteJobStore((s) => s.githubUrl);
  const setGithubUrl = useCriarSiteJobStore((s) => s.setGithubUrl);
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
  const nUser = lista.filter((m) => m.papel === 'user').length;
  const emConversa = nUser > 0;

  /** URL absoluta para iframe / links (proxy Vite em dev). */
  const previewAbsUrl = useMemo(() => {
    if (!siteResult?.previewUrl) return null;
    const u = siteResult.previewUrl;
    if (u.startsWith('http')) return u;
    return `${window.location.origin}${u.startsWith('/') ? '' : '/'}${u}`;
  }, [siteResult?.previewUrl]);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lista, aEnviar, aGerar, aPublicar]);

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
          const gh = String(r.github ?? '');
          const site = String(r.siteUrl ?? '').trim() || null;
          const deployOk = Boolean(r.deployOk ?? r.success);
          const actions = String(r.actionsUrl ?? '').trim();
          const dnsOk = Boolean(r.dnsApplied);
          const cr = String(r.cloudRun ?? '').trim();

          setGithubUrl(gh);
          setPublicSiteUrl(site);

          let textoSucesso = '';
          if (deployOk && site) {
            const partes = [`Publicação concluída!`, `Site: ${site}`];
            if (cr && cr !== site) {
              partes.push(`Cloud Run (directo): ${cr}`);
            }
            if (!dnsOk) {
              partes.push(
                `Nota: o subdomínio (https://slug.${ROOT_DOMAIN}) é criado pela API com Cloudflare depois do deploy — não pelo workflow GitHub. ` +
                  `Para o URL bonito, defina no .env da API: CLOUDFLARE_TOKEN, CLOUDFLARE_ZONE_ID e ROOT_DOMAIN (e use GET /api/publish/config para slug obrigatório).`
              );
            }
            partes.push(`GitHub: ${gh}`);
            textoSucesso = partes.join('\n');
          } else {
            textoSucesso = `Repositório privado criado: ${gh}${actions ? `\nActions (ver o deploy): ${actions}` : ''}\nO URL público ainda não foi detetado a tempo — abra Actions ou confira IAM no GCP.`;
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
  }, [publishJobId, clearPublishJob]);

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
    setGithubUrl(null);
    setPublicSiteUrl(null);
    setPublishSlug('');

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
    setGithubUrl(null);
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
        'animate-fade-in w-full max-w-[42rem] mx-auto flex flex-col',
        'min-h-[calc(100dvh-8.5rem)] md:min-h-[calc(100dvh-7rem)]'
      )}
    >
      {emConversa && (
        <header className="flex flex-wrap items-center justify-between gap-2 gap-y-3 shrink-0 pb-3 md:pb-4">
          <h1 className="text-sm font-medium text-muted-foreground truncate">{TITULO_PAGINA}</h1>
          <div className="flex items-center gap-2">
            <HistoricoSitesDrawer />
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 rounded-full h-9 gap-1.5 text-xs font-normal"
                onClick={resetAll}
              >
                Novo Site
              </Button>
              {siteResult && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-full h-9 gap-1.5 text-xs font-normal border-border/80"
                  asChild
                >
                  <a href={previewAbsUrl ?? siteResult.previewUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                    Abrir no separador
                  </a>
                </Button>
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
        </header>
      )}

      <div className={cn('flex-1 flex flex-col min-h-0', !emConversa && 'justify-center')}>
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

        {(githubUrl || publicSiteUrl) && emConversa && (
          <div className="mb-3 shrink-0 space-y-2">
            {publicSiteUrl && (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">Site público</p>
                <a
                  href={publicSiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-emerald-700 dark:text-emerald-400 underline-offset-4 hover:underline break-all"
                >
                  {publicSiteUrl}
                </a>
              </div>
            )}
            {githubUrl && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">GitHub</p>
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline break-all"
                >
                  {githubUrl}
                </a>
              </div>
            )}
          </div>
        )}

        {siteResult && previewAbsUrl && emConversa && (
          <div className="mb-4 shrink-0 rounded-xl border bg-muted/30 overflow-hidden">
            <p className="text-xs font-medium text-muted-foreground px-3 py-2 border-b bg-background/80">
              Pré-visualização (HTML + CSS como no navegador)
            </p>
            <iframe
              title="Pré-visualização do site gerado"
              src={previewAbsUrl}
              className="w-full min-h-[320px] md:min-h-[420px] bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </div>
        )}

        {!emConversa ? (
          <div className="flex flex-col items-center justify-center px-3 sm:px-6 py-6 md:py-10">
            <div className="w-full max-w-xl text-center space-y-4 md:space-y-5 mb-8 md:mb-10">
              <h2
                className={cn(
                  'text-[1.65rem] sm:text-3xl md:text-4xl font-medium tracking-tight',
                  'text-foreground leading-[1.2]'
                )}
              >
                {TITULO_PAGINA}
              </h2>
              <p className="text-muted-foreground text-[15px] sm:text-base leading-relaxed text-balance">
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
        ) : (
          <div
            className={cn(
              'flex-1 overflow-y-auto min-h-0 pr-1 -mr-1 space-y-6 md:space-y-8',
              'pb-4'
            )}
          >
            {lista.map((m) => (
              <div key={m.id}>
                {m.papel === 'bot' ? (
                  <div className="max-w-[95%] md:max-w-2xl">
                    <p className="whitespace-pre-wrap text-[15px] sm:text-base leading-[1.65] text-foreground">
                      {m.texto}
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
            ))}
            {(aEnviar || aGerar || aPublicar) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin shrink-0 opacity-70" />
                {aPublicar
                  ? 'A publicar em segundo plano (GitHub → Cloud Run). Pode fechar esta página — o progresso continua.'
                  : aGerar
                    ? 'A gerar o site em segundo plano. Pode fechar esta página — o progresso continua.'
                    : LOADING_TEXTO}
              </div>
            )}
            <div ref={fim} className="h-px" />
          </div>
        )}
      </div>

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
  );
}
