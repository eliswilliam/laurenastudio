import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from 'grapesjs';
import { Loader2, Rocket, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GrapesTemplateEditor } from '@/components/grapes/GrapesTemplateEditor';
import { DEFAULT_TEMPLATE_CSS, getDefaultTemplateHtml } from '@/components/grapes/defaultTemplate';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/useAuthStore';
import { useTemplatePublishStore } from '@/store/useTemplatePublishStore';
import { getPublishConfig, getPublishJobStatus, postPublish, postSaveTemplate } from '@/lib/publishApi';
import { formatApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const POLL_MS = 2500;

const ROOT_DOMAIN =
  (import.meta.env.VITE_ROOT_DOMAIN as string | undefined)?.trim() || 'laurenastudio.pro';

// Nomes de subdomínio reservados pelo sistema — espelha o backend (dns_service.py RESERVED_SLUGS).
const RESERVED_SLUGS = new Set([
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

function slugValid(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (!t || t.length > 63) return false;
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(t);
}

function slugReserved(s: string): boolean {
  return RESERVED_SLUGS.has(s.trim().toLowerCase());
}

type SlugError = 'reserved' | 'invalid' | null;

function getSlugError(s: string): SlugError {
  const t = s.trim().toLowerCase();
  if (!t) return null;
  if (slugReserved(t)) return 'reserved';
  if (!slugValid(t)) return 'invalid';
  return null;
}

function userFacingSiteUrl(slug: string, siteUrl: string | null): string | null {
  const s = slug.trim().toLowerCase();
  if (s && slugValid(s)) {
    return `https://${s}.${ROOT_DOMAIN}`;
  }
  const u = (siteUrl ?? '').trim();
  if (u && !/run\.app|github\.com/i.test(u)) {
    return u;
  }
  return siteUrl;
}

function buildTemplateFiles(ed: Editor, activeLocale: string): { path: string; content: string }[] {
  const html = ed.getHtml();
  const css = ed.getCss();
  const js = typeof (ed as Editor & { getJs?: () => string }).getJs === 'function'
    ? (ed as Editor & { getJs: () => string }).getJs()
    : '';

  const documentHtml = [
    '<!DOCTYPE html>',
    `<html lang="${activeLocale}">`,
    '<head>',
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '<title>Laurena Site</title>',
    '<link rel="stylesheet" href="styles.css" />',
    '</head>',
    `<body>${html}</body>`,
    js.trim() ? '<script src="app.js" defer></script>' : '',
    '</html>',
  ].filter(Boolean).join('');

  return [
    { path: 'index.html', content: documentHtml },
    { path: 'styles.css', content: css || '/* Empty stylesheet */\n' },
    ...(js.trim() ? [{ path: 'app.js', content: js }] : []),
  ];
}

export default function Template() {
  const editorRef = useRef<Editor | null>(null);
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const userId = useAuthStore((s) => s.usuario?.id);
  const projectId = useTemplatePublishStore((s) => s.projectId);
  const setProjectId = useTemplatePublishStore((s) => s.setProjectId);
  const publishJobId = useTemplatePublishStore((s) => s.publishJobId);
  const setPublishJobId = useTemplatePublishStore((s) => s.setPublishJobId);
  const clearPublishJob = useTemplatePublishStore((s) => s.clearPublishJob);
  const publishSlug = useTemplatePublishStore((s) => s.publishSlug);
  const setPublishSlug = useTemplatePublishStore((s) => s.setPublishSlug);
  const publishState = useTemplatePublishStore((s) => s.publishState);
  const publishedUrl = useTemplatePublishStore((s) => s.publishedUrl);
  const publishError = useTemplatePublishStore((s) => s.publishError);
  const markPublishing = useTemplatePublishStore((s) => s.markPublishing);
  const markPublishSuccess = useTemplatePublishStore((s) => s.markPublishSuccess);
  const markPublishFailed = useTemplatePublishStore((s) => s.markPublishFailed);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Auto-dismiss save notification: 3s for success, 6s for error
  useEffect(() => {
    if (saveState === 'idle' || saveState === 'saving') return;
    const delay = saveState === 'saved' ? 3000 : 6000;
    const timer = setTimeout(() => setSaveState('idle'), delay);
    return () => clearTimeout(timer);
  }, [saveState]);

  // Auto-dismiss publish notification: 5s for success/failed (worker done)
  useEffect(() => {
    if (publishState === 'idle' || publishState === 'publishing') return;
    const delay = publishState === 'success' ? 5000 : 7000;
    const timer = setTimeout(() => markPublishFailed(null), delay);
    return () => clearTimeout(timer);
  }, [publishState, markPublishFailed]);
  const [requirePublishSlug, setRequirePublishSlug] = useState(false);
  const preferred = i18n.resolvedLanguage ?? i18n.language;
  const activeLocale = preferred || navigator.language || 'en';
  const initialTemplateHtml = useMemo(() => getDefaultTemplateHtml(activeLocale), [activeLocale]);
  const publishing = isSubmitting || Boolean(publishJobId);
  const busy = publishing || isSaving;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cfg = await getPublishConfig();
        if (!active) return;
        setRequirePublishSlug(Boolean(cfg.requireSlug));
      } catch {
        if (!active) return;
        setRequirePublishSlug(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!publishJobId) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const finish = () => {
      if (intervalId !== undefined) clearInterval(intervalId);
    };

    const tick = async () => {
      if (cancelled) return;
      try {
        const job = await getPublishJobStatus(publishJobId);
        if (cancelled) return;

        if (job.status === 'success') {
          finish();
          const result = (job.result ?? {}) as Record<string, unknown>;
          const siteUrlRaw = typeof result.siteUrl === 'string' ? result.siteUrl : null;
          const deployOk = Boolean(result.deployOk ?? result.success);
          const visibleSiteUrl = userFacingSiteUrl(publishSlug, siteUrlRaw);

          if (deployOk) {
            markPublishSuccess(visibleSiteUrl);
            toast({
              title: t('pages.templateBuilder.publishSuccessTitle'),
              description: visibleSiteUrl
                ? t('pages.templateBuilder.publishSuccessWithUrl', { url: visibleSiteUrl })
                : t('pages.templateBuilder.publishSuccessDescription'),
            });
            if (visibleSiteUrl) {
              window.open(visibleSiteUrl, '_blank', 'noopener,noreferrer');
            }
          } else {
            markPublishSuccess(visibleSiteUrl);
            toast({
              title: t('pages.templateBuilder.publishQueuedTitle'),
              description: t('pages.criarSite.publishWarnings'),
            });
          }

          clearPublishJob();
          setIsSubmitting(false);
          return;
        }

        if (job.status === 'failed') {
          finish();
          throw new Error(job.error || t('pages.templateBuilder.publishJobFailed'));
        }
      } catch (error) {
        if (cancelled) return;
        finish();
        const message = formatApiError(error);
        toast({
          title: t('pages.templateBuilder.publishErrorTitle'),
          description: message,
          variant: 'destructive',
        });
        markPublishFailed(message);
        clearPublishJob();
        setIsSubmitting(false);
      }
    };

    void tick();
    intervalId = setInterval(() => void tick(), POLL_MS);

    return () => {
      cancelled = true;
      finish();
    };
  }, [clearPublishJob, markPublishFailed, markPublishSuccess, publishJobId, publishSlug, t, toast]);

  const handleEditorReady = useCallback((ed: Editor) => {
    editorRef.current = ed;
    const hideButtonIds = [
      'export-template',
      'open-code',
      'set-locale',
      'change-locale',
      'locale',
      'locale-select',
    ];
    const panels = ['options', 'commands', 'views', 'devices-c'];
    panels.forEach((panelId) => {
      hideButtonIds.forEach((btnId) => {
        ed.Panels.removeButton(panelId, btnId);
      });
    });
  }, []);

  const handlePublish = async () => {
    const ed = editorRef.current;
    if (!ed) {
      toast({
        title: t('pages.templateBuilder.publishErrorTitle'),
        description: t('pages.templateBuilder.editorNotReady'),
        variant: 'destructive',
      });
      return;
    }
    if (!userId) {
      toast({
        title: t('pages.templateBuilder.publishErrorTitle'),
        description: t('pages.templateBuilder.publishAuthRequired'),
        variant: 'destructive',
      });
      return;
    }

    const slug = publishSlug.trim().toLowerCase();
    if (requirePublishSlug && !slug) {
      toast({
        title: t('pages.templateBuilder.publishErrorTitle'),
        description: t('pages.criarSite.errors.slugRequired'),
        variant: 'destructive',
      });
      return;
    }
    if (slug) {
      const slugErr = getSlugError(slug);
      if (slugErr === 'reserved') {
        toast({
          title: t('pages.templateBuilder.publishErrorTitle'),
          description: t('pages.criarSite.errors.slugReserved'),
          variant: 'destructive',
        });
        return;
      }
      if (slugErr === 'invalid') {
        toast({
          title: t('pages.templateBuilder.publishErrorTitle'),
          description: t('pages.criarSite.errors.slugInvalid'),
          variant: 'destructive',
        });
        return;
      }
    }

    const files = buildTemplateFiles(ed, activeLocale);

    setIsSubmitting(true);
    markPublishing();
    try {
      // Always auto-save first to ensure projectId is valid and up-to-date.
      // If the stored projectId is stale (deleted from DB → 404), reset and
      // create a fresh project so publish never errors with "Site project not found".
      let currentProjectId = projectId;
      try {
        const saved = await postSaveTemplate({
          userId,
          projectId: currentProjectId,
          files,
          ...(slug ? { slug } : {}),
        });
        currentProjectId = saved.projectId;
        setProjectId(currentProjectId);
      } catch (saveErr) {
        const msg = saveErr instanceof Error ? saveErr.message.toLowerCase() : '';
        if (currentProjectId && (msg.includes('not found') || msg.includes('404'))) {
          setProjectId(null);
          const saved = await postSaveTemplate({
            userId, projectId: null, files, ...(slug ? { slug } : {}),
          });
          currentProjectId = saved.projectId;
          setProjectId(currentProjectId);
        } else {
          throw saveErr;
        }
      }

      const enqueue = await postPublish({
        userId,
        projectId: currentProjectId,
        files,
        ...(slug ? { slug } : {}),
      });
      toast({
        title: t('pages.templateBuilder.publishQueuedTitle'),
        description: t('pages.templateBuilder.publishQueuedDescription'),
      });
      setPublishJobId(enqueue.jobId);
      if (enqueue.projectId) {
        setProjectId(enqueue.projectId);
      }
      setIsSubmitting(false);
    } catch (error) {
      const message = formatApiError(error);
      toast({
        title: t('pages.templateBuilder.publishErrorTitle'),
        description: message,
        variant: 'destructive',
      });
      markPublishFailed(message);
      setIsSubmitting(false);
    }
  };

  const handleSave = async () => {
    const ed = editorRef.current;
    if (!ed) {
      setSaveState('failed');
      setSaveError(t('pages.templateBuilder.editorNotReady'));
      toast({
        title: t('pages.templateBuilder.saveErrorTitle'),
        description: t('pages.templateBuilder.editorNotReady'),
        variant: 'destructive',
      });
      return;
    }
    if (!userId) {
      toast({
        title: t('pages.templateBuilder.saveErrorTitle'),
        description: t('pages.templateBuilder.saveAuthRequired'),
        variant: 'destructive',
      });
      setSaveState('failed');
      setSaveError(t('pages.templateBuilder.saveAuthRequired'));
      return;
    }

    const slug = publishSlug.trim().toLowerCase();
    if (slug) {
      const slugErr = getSlugError(slug);
      if (slugErr === 'reserved') {
        const msg = t('pages.criarSite.errors.slugReserved');
        toast({ title: t('pages.templateBuilder.saveErrorTitle'), description: msg, variant: 'destructive' });
        setSaveState('failed');
        setSaveError(msg);
        return;
      }
      if (slugErr === 'invalid') {
        const msg = t('pages.criarSite.errors.slugInvalid');
        toast({ title: t('pages.templateBuilder.saveErrorTitle'), description: msg, variant: 'destructive' });
        setSaveState('failed');
        setSaveError(msg);
        return;
      }
    }

    setIsSaving(true);
    setSaveState('saving');
    setSaveError(null);
    try {
      const files = buildTemplateFiles(ed, activeLocale);
      let response;
      try {
        response = await postSaveTemplate({ userId, projectId, files, ...(slug ? { slug } : {}) });
      } catch (firstErr) {
        // Stale projectId persisted in the store but deleted from DB → 404.
        // Reset and retry as a brand-new project so the user is never stuck.
        const msg = firstErr instanceof Error ? firstErr.message.toLowerCase() : '';
        if (projectId && (msg.includes('not found') || msg.includes('404'))) {
          setProjectId(null);
          response = await postSaveTemplate({ userId, projectId: null, files, ...(slug ? { slug } : {}) });
        } else {
          throw firstErr;
        }
      }
      setProjectId(response.projectId);
      setSaveState('saved');
      toast({
        title: t('pages.templateBuilder.saveSuccessTitle'),
        description: t('pages.templateBuilder.saveSuccessDescription'),
      });
    } catch (error) {
      const message = formatApiError(error);
      setSaveState('failed');
      setSaveError(message);
      toast({
        title: t('pages.templateBuilder.saveErrorTitle'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-[#e7c0aa] bg-gradient-to-br from-[#fff4ec] via-[#fff9f5] to-[#ffe8da] p-3 shadow-[0_10px_28px_rgba(207,101,55,0.14)] sm:p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left — title block */}
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#f0c4a8] bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#c4623a]">
              <Sparkles className="h-3.5 w-3.5" />
              Laurena Builder
            </p>
            <h1 className="mt-2 text-lg font-black text-[#2f1a12] sm:text-xl">
              {t('pages.templateBuilder.title')}
            </h1>
            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-[#704232] sm:text-xs">
              {t('pages.templateBuilder.subtitle')}
            </p>
          </div>

          {/* Right — subdomain + actions */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end lg:shrink-0">
            {/* Subdomain input */}
            <div className="w-full sm:w-56">
              <label htmlFor="template-publish-slug" className="mb-1 block text-[11px] font-medium text-[#5e3728]">
                {t('pages.criarSite.subdomain')} {requirePublishSlug ? t('pages.criarSite.required') : t('pages.criarSite.optional')}
              </label>
              <Input
                id="template-publish-slug"
                type="text"
                inputMode="text"
                autoComplete="off"
                placeholder={t('pages.criarSite.slugPlaceholder')}
                value={publishSlug}
                onChange={(e) => setPublishSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                disabled={busy}
                className="h-9 rounded-md border-[#e8b79a] bg-white/95 text-xs"
              />
              <p className="mt-0.5 min-h-[14px] truncate text-[10px]">
                {(() => {
                  const s = publishSlug.trim().toLowerCase();
                  if (!s) return <span className="text-[#6f4634]">&nbsp;</span>;
                  if (slugReserved(s))
                    return <span className="text-destructive">{t('pages.criarSite.errors.slugReserved')}</span>;
                  if (!slugValid(s))
                    return <span className="text-destructive">{t('pages.criarSite.errors.slugInvalid')}</span>;
                  return <span className="text-[#6f4634]">{`https://${s}.${ROOT_DOMAIN}`}</span>;
                })()}
              </p>
            </div>

            {/* Buttons — aligned to bottom of input group */}
            <div className="flex items-center gap-2 pb-[18px]">
              <Button
                type="button"
                variant="outline"
                className="h-9 gap-1.5 border-[#e8b79a] bg-white/85 px-3 text-xs text-[#7a3f29] hover:bg-white"
                onClick={handleSave}
                disabled={busy}
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {isSaving ? t('pages.templateBuilder.saving') : t('pages.templateBuilder.saveButton')}
              </Button>
              <Button
                type="button"
                className="h-9 gap-1.5 bg-[#cf6537] px-3 text-xs text-[#fff8f2] hover:bg-[#b8572d]"
                onClick={handlePublish}
                disabled={busy}
              >
                {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                {publishing ? t('pages.templateBuilder.publishing') : t('pages.criarSite.publishButton')}
              </Button>
            </div>
          </div>
        </div>

        {saveState !== 'idle' && (
          <div
            className={[
              'mx-auto mb-2 max-w-md rounded-lg border px-3 py-2 text-center text-xs',
              saveState === 'saving'
                ? 'border-sky-300/60 bg-sky-50 text-sky-800'
                : saveState === 'saved'
                ? 'border-emerald-300/60 bg-emerald-50 text-emerald-800'
                : 'border-destructive/30 bg-destructive/5 text-destructive',
            ].join(' ')}
          >
            {saveState === 'saving' && t('pages.templateBuilder.saveStatusSaving')}
            {saveState === 'saved' && t('pages.templateBuilder.saveStatusSaved')}
            {saveState === 'failed' && (
              saveError
                ? t('pages.templateBuilder.saveStatusFailedWithReason', { reason: saveError })
                : t('pages.templateBuilder.saveStatusFailed')
            )}
          </div>
        )}

        {publishState !== 'idle' && (
          <div
            className={[
              'mx-auto mt-2 max-w-md rounded-lg border px-3 py-2 text-center text-xs',
              publishState === 'publishing'
                ? 'border-amber-300/60 bg-amber-50 text-amber-800'
                : publishState === 'success'
                ? 'border-emerald-300/60 bg-emerald-50 text-emerald-800'
                : 'border-destructive/30 bg-destructive/5 text-destructive',
            ].join(' ')}
          >
            {publishState === 'publishing' && t('pages.templateBuilder.publishStatusPublishing')}
            {publishState === 'success' && (
              publishedUrl
                ? t('pages.templateBuilder.publishStatusSuccessWithUrl', { url: publishedUrl })
                : t('pages.templateBuilder.publishStatusSuccess')
            )}
            {publishState === 'failed' && (
              publishError
                ? t('pages.templateBuilder.publishStatusFailedWithReason', { reason: publishError })
                : t('pages.templateBuilder.publishStatusFailed')
            )}
          </div>
        )}
      </section>

      <div className="h-[calc(100vh-18rem)] min-h-[520px] overflow-hidden rounded-2xl border border-[#ebc0aa] bg-[#fff9f5] p-2 shadow-[0_10px_32px_rgba(87,43,24,0.14)] sm:p-3">
        <GrapesTemplateEditor
          ref={editorRef}
          locale={activeLocale}
          whenReady={handleEditorReady}
          initialComponents={initialTemplateHtml}
          initialStyle={DEFAULT_TEMPLATE_CSS}
          className="h-full w-full overflow-hidden rounded-xl border border-[#f3c9ae] bg-white"
        />
      </div>
    </div>
  );
}
