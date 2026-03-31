import type { EditorConfig } from 'grapesjs';

import gjsPresetWebpage from 'grapesjs-preset-webpage';
import gjsBlocksBasic from 'grapesjs-blocks-basic';
import gjsPluginForms from 'grapesjs-plugin-forms';
import gjsComponentCountdown from 'grapesjs-component-countdown';
import gjsPluginExport from 'grapesjs-plugin-export';
import gjsTabs from 'grapesjs-tabs';
import gjsCustomCode from 'grapesjs-custom-code';
import gjsTouch from 'grapesjs-touch';
import gjsParserPostcss from 'grapesjs-parser-postcss';
import gjsTooltip from 'grapesjs-tooltip';
import gjsTuiImageEditor from 'grapesjs-tui-image-editor';
import gjsTyped from 'grapesjs-typed';
import gjsStyleBg from 'grapesjs-style-bg';

export type GrapesEditorConfigOptions = {
  canvasStyles?: string[];
  assetBaseUrl?: string;
  assetUrls?: string[];
};

const defaultAssets = (base = '/assets/images/demos'): string[] => {
  const lp = `${base.replace(/\/$/, '')}/`;
  const plp = 'https://via.placeholder.com/350x250/';
  return [
    `${lp}team1.jpg`,
    `${lp}team2.jpg`,
    `${lp}team3.jpg`,
    `${plp}78c5d6/fff`,
    `${plp}459ba8/fff`,
    `${plp}79c267/fff`,
    `${plp}c5d647/fff`,
    `${plp}f28c33/fff`,
    `${plp}e868a2/fff`,
    `${plp}cc4360/fff`,
    `${lp}work-desk.jpg`,
    `${lp}phone-app.png`,
    `${lp}bg-gr-v.png`,
  ];
};

export function createGrapesEditorConfig(options: GrapesEditorConfigOptions = {}): Partial<EditorConfig> {
  const { canvasStyles = [], assetBaseUrl, assetUrls: assetUrlsOpt } = options;
  const assetUrls = assetUrlsOpt ?? defaultAssets(assetBaseUrl);

  return {
    height: '100%',
    fromElement: false,
    showOffsets: true,
    storageManager: false,
    canvas: canvasStyles.length ? { styles: canvasStyles } : undefined,
    assetManager: {
      embedAsBase64: true,
      assets: assetUrls,
    },
    selectorManager: { componentFirst: true },
    plugins: [
      gjsBlocksBasic,
      gjsPluginForms,
      gjsComponentCountdown,
      gjsPluginExport,
      gjsTabs,
      gjsCustomCode,
      gjsTouch,
      gjsParserPostcss,
      gjsTooltip,
      gjsTuiImageEditor,
      gjsTyped,
      gjsStyleBg,
      gjsPresetWebpage,
    ],
    pluginsOpts: {
      'gjs-blocks-basic': { flexGrid: true },
      'grapesjs-tui-image-editor': {
        script: [
          'https://uicdn.toast.com/tui.code-snippet/v1.5.2/tui-code-snippet.min.js',
          'https://uicdn.toast.com/tui-color-picker/v2.2.7/tui-color-picker.min.js',
          'https://uicdn.toast.com/tui-image-editor/v3.15.2/tui-image-editor.min.js',
        ],
        style: [
          'https://uicdn.toast.com/tui-color-picker/v2.2.7/tui-color-picker.min.css',
          'https://uicdn.toast.com/tui-image-editor/v3.15.2/tui-image-editor.min.css',
        ],
      },
      'grapesjs-tabs': { tabsBlock: { category: 'Extra' } },
      'grapesjs-typed': {
        block: {
          category: 'Extra',
          content: {
            type: 'typed',
            'type-speed': 40,
            strings: ['Text row one', 'Text row two', 'Text row three'],
          },
        },
      },
      'grapesjs-preset-webpage': {
        modalImportTitle: 'Import Template',
        modalImportLabel: 'Paste here your HTML/CSS and click Import',
        modalImportContent: (editor: import('grapesjs').Editor) => `${editor.getHtml()} ${editor.getCss()}`,
      },
    },
  };
}
