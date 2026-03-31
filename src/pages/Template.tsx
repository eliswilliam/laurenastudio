import { useRef } from 'react';
import type { Editor } from 'grapesjs';
import { Button } from '@/components/ui/button';
import { GrapesTemplateEditor } from '@/components/grapes/GrapesTemplateEditor';
import { DEFAULT_TEMPLATE_CSS, getDefaultTemplateHtml } from '@/components/grapes/defaultTemplate';
import { useTranslation } from '@/hooks/useTranslation';

export default function Template() {
  const editorRef = useRef<Editor | null>(null);
  const { t, i18n } = useTranslation();
  const activeLocale = i18n.resolvedLanguage ?? i18n.language;

  return (
    <div className="h-[calc(100vh-2rem)] min-h-[700px]">
      <div className="mb-3 flex items-center justify-between rounded-lg border bg-card p-3">
        <div>
          <h1 className="text-lg font-semibold">{t('pages.templateBuilder.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('pages.templateBuilder.subtitle')}</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            const ed = editorRef.current;
            if (!ed) return;
            const html = ed.getHtml();
            const css = ed.getCss();
            void navigator.clipboard.writeText(`${html}\n<style>${css}</style>`);
          }}
        >
          {t('pages.templateBuilder.copyHtmlCss')}
        </Button>
      </div>

      <div className="h-[calc(100%-4.25rem)] overflow-hidden rounded-lg border bg-background">
        <GrapesTemplateEditor
          ref={editorRef}
          locale={activeLocale}
          initialComponents={getDefaultTemplateHtml(activeLocale)}
          initialStyle={DEFAULT_TEMPLATE_CSS}
        />
      </div>
    </div>
  );
}
