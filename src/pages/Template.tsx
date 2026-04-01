import { useRef } from 'react';
import type { Editor } from 'grapesjs';
import { Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GrapesTemplateEditor } from '@/components/grapes/GrapesTemplateEditor';
import { DEFAULT_TEMPLATE_CSS, getDefaultTemplateHtml } from '@/components/grapes/defaultTemplate';
import { useTranslation } from '@/hooks/useTranslation';

export default function Template() {
  const editorRef = useRef<Editor | null>(null);
  const { t, i18n } = useTranslation();
  const preferred = i18n.resolvedLanguage ?? i18n.language;
  const activeLocale = preferred || navigator.language || 'en';

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-[#e7c0aa] bg-gradient-to-br from-[#fff4ec] via-[#fff9f5] to-[#ffe8da] p-5 shadow-[0_16px_50px_rgba(207,101,55,0.2)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#f0c4a8] bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#c4623a]">
              <Sparkles className="h-3.5 w-3.5" />
              Laurena Builder
            </p>
            <h1 className="mt-3 text-2xl font-black text-[#2f1a12] sm:text-3xl">
              {t('pages.templateBuilder.title')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[#704232] sm:text-base">
              {t('pages.templateBuilder.subtitle')}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="rounded-xl border border-[#f2c3a6] bg-white/80 px-3 py-2 text-xs text-[#8b4d35]">
              {activeLocale.toUpperCase()}
            </div>
            <Button
              type="button"
              className="gap-2 bg-[#cf6537] text-[#fff8f2] hover:bg-[#b8572d]"
              onClick={() => {
                const ed = editorRef.current;
                if (!ed) return;
                const html = ed.getHtml();
                const css = ed.getCss();
                void navigator.clipboard.writeText(`${html}\n<style>${css}</style>`);
              }}
            >
              <Wand2 className="h-4 w-4" />
              {t('pages.templateBuilder.copyHtmlCss')}
            </Button>
          </div>
        </div>
      </section>

      <div className="h-[calc(100vh-14rem)] min-h-[680px] overflow-hidden rounded-2xl border border-[#ebc0aa] bg-[#fff9f5] p-2 shadow-[0_12px_40px_rgba(87,43,24,0.16)] sm:p-3">
        <GrapesTemplateEditor
          ref={editorRef}
          locale={activeLocale}
          initialComponents={getDefaultTemplateHtml(activeLocale)}
          initialStyle={DEFAULT_TEMPLATE_CSS}
          className="h-full w-full overflow-hidden rounded-xl border border-[#f3c9ae] bg-white"
        />
      </div>
    </div>
  );
}
