import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
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
    const editorRef = useRef<Editor | null>(null);
    const whenReadyRef = useRef<typeof whenReady>(whenReady);

    useImperativeHandle(ref, () => editorRef.current, []);

    useEffect(() => {
      whenReadyRef.current = whenReady;
    }, [whenReady]);

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
      editorRef.current = ed;
      whenReadyRef.current?.(ed);

      return () => {
        ed.destroy();
        editorRef.current = null;
      };
    }, [assetBaseUrl, canvasStyles, initialComponents, initialStyle, locale]);

    return (
      <div
        className={['laurena-template-editor', className].filter(Boolean).join(' ')}
        ref={rootRef}
        style={{ height: '100%', minHeight: '70vh', width: '100%' }}
      />
    );
  }
);
