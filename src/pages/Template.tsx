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
import { useToast } from '@/hooks/use-toast';

const POLL_MS = 2500;

const ROOT_DOMAIN =
  (import.meta.env.VITE_ROOT_DOMAIN as string | undefined)?.trim() || 'laurenastudio.pro';

function slugValid(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (!t || t.length > 63) return false;
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(t);
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
        const message = error instanceof Error ? error.message : t('pages.templateBuilder.publishErrorDescription');
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
        description: 'Editor not ready yet. Please wait a second and try again.',
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
    if (slug && !slugValid(slug)) {
      toast({
        title: t('pages.templateBuilder.publishErrorTitle'),
        description: t('pages.criarSite.errors.slugInvalid'),
        variant: 'destructive',
      });
      return;
    }

    const files = buildTemplateFiles(ed, activeLocale);

    setIsSubmitting(true);
    markPublishing();
    try {
      const enqueue = await postPublish({
        userId,
        projectId,
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
      const message = error instanceof Error ? error.message : t('pages.templateBuilder.publishErrorDescription');
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
      setSaveError('Editor not ready yet. Please wait a second and try again.');
      toast({
        title: t('pages.templateBuilder.saveErrorTitle'),
        description: 'Editor not ready yet. Please wait a second and try again.',
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
    if (slug && !slugValid(slug)) {
      toast({
        title: t('pages.templateBuilder.saveErrorTitle'),
        description: t('pages.criarSite.errors.slugInvalid'),
        variant: 'destructive',
      });
      setSaveState('failed');
      setSaveError(t('pages.criarSite.errors.slugInvalid'));
      return;
    }

    setIsSaving(true);
    setSaveState('saving');
    setSaveError(null);
    try {
      const files = buildTemplateFiles(ed, activeLocale);
      const response = await postSaveTemplate({
        userId,
        projectId,
        files,
        ...(slug ? { slug } : {}),
      });
      setProjectId(response.projectId);
      setSaveState('saved');
      toast({
        title: t('pages.templateBuilder.saveSuccessTitle'),
        description: t('pages.templateBuilder.saveSuccessDescription'),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('pages.templateBuilder.saveErrorDescription');
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#f0c4a8] bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#c4623a]">
              <Sparkles className="h-3.5 w-3.5" />
              Laurena Builder
            </p>
            <h1 className="mt-1.5 text-lg font-black text-[#2f1a12] sm:text-xl">
              {t('pages.templateBuilder.title')}
            </h1>
            <p className="mt-1 max-w-2xl text-[11px] text-[#704232] sm:text-xs">
              {t('pages.templateBuilder.subtitle')}
            </p>
          </div>

          <div className="w-full flex flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            <div className="w-full sm:w-64">
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
              <p className="mt-1 min-h-[14px] text-[10px] text-[#6f4634]">
                {slugValid(publishSlug.trim())
                  ? `https://${publishSlug.trim().toLowerCase()}.${ROOT_DOMAIN}`
                  : '\u00A0'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-9 gap-2 border-[#e8b79a] bg-white/85 px-4 text-[#7a3f29] hover:bg-white"
              onClick={handleSave}
              disabled={busy}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? t('pages.templateBuilder.saving') : t('pages.templateBuilder.saveButton')}
            </Button>
            <Button
              type="button"
              className="h-9 gap-2 bg-[#cf6537] px-4 text-[#fff8f2] hover:bg-[#b8572d]"
              onClick={handlePublish}
              disabled={busy}
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {publishing ? t('pages.templateBuilder.publishing') : t('pages.criarSite.publishButton')}
            </Button>
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
