import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import grapesjs from 'grapesjs';
import type { Editor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import './laurenaEditorTheme.css';
import { createGrapesEditorConfig } from './createGrapesEditorConfig';

export type GrapesTemplateEditorProps = {
  className?: string;
  initialComponents?: string;
  initialStyle?: string;
  canvasStyles?: string[];
  assetBaseUrl?: string;
  locale?: string;
  whenReady?: (editor: Editor) => void;
};

export const GrapesTemplateEditor = forwardRef<Editor | null, GrapesTemplateEditorProps>(
  function GrapesTemplateEditor(
    { className, initialComponents, initialStyle, canvasStyles, assetBaseUrl, locale, whenReady },
    ref
  ) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [editor, setEditor] = useState<Editor | null>(null);

    useImperativeHandle(ref, () => editor, [editor]);

    useEffect(() => {
      const el = rootRef.current;
      if (!el) return undefined;

      const ed = grapesjs.init({
        ...createGrapesEditorConfig({
          canvasStyles,
          assetBaseUrl,
          locale,
        }),
        container: el,
        components: initialComponents,
        style: initialStyle,
      });
      setEditor(ed);
      whenReady?.(ed);

      return () => {
        ed.destroy();
        setEditor(null);
      };
    }, [assetBaseUrl, canvasStyles, initialComponents, initialStyle, locale, whenReady]);

    return (
      <div
        className={['laurena-template-editor', className].filter(Boolean).join(' ')}
        ref={rootRef}
        style={{ height: '100%', minHeight: '70vh', width: '100%' }}
      />
    );
  }
);
