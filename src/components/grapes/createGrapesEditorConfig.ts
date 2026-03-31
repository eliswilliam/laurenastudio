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
import grapesLocaleEn from 'grapesjs/locale/en';
import grapesLocaleEs from 'grapesjs/locale/es';
import grapesLocaleFr from 'grapesjs/locale/fr';
import grapesLocalePt from 'grapesjs/locale/pt';

export type GrapesEditorConfigOptions = {
  canvasStyles?: string[];
  assetBaseUrl?: string;
  assetUrls?: string[];
  locale?: string;
};

type SupportedLocale = 'en' | 'es' | 'fr' | 'pt';

const localeByCode: Record<SupportedLocale, Record<string, unknown>> = {
  en: grapesLocaleEn as Record<string, unknown>,
  es: grapesLocaleEs as Record<string, unknown>,
  fr: grapesLocaleFr as Record<string, unknown>,
  pt: grapesLocalePt as Record<string, unknown>,
};

const pluginLocaleByCode: Record<SupportedLocale, {
  extraCategory: string;
  typedStrings: [string, string, string];
  importTemplateTitle: string;
  importTemplateLabel: string;
}> = {
  en: {
    extraCategory: 'Extra',
    typedStrings: ['Text row one', 'Text row two', 'Text row three'],
    importTemplateTitle: 'Import Template',
    importTemplateLabel: 'Paste your HTML/CSS here and click Import',
  },
  es: {
    extraCategory: 'Extra',
    typedStrings: ['Linea de texto uno', 'Linea de texto dos', 'Linea de texto tres'],
    importTemplateTitle: 'Importar plantilla',
    importTemplateLabel: 'Pega aqui tu HTML/CSS y haz clic en Importar',
  },
  fr: {
    extraCategory: 'Extra',
    typedStrings: ['Ligne de texte une', 'Ligne de texte deux', 'Ligne de texte trois'],
    importTemplateTitle: 'Importer un template',
    importTemplateLabel: 'Collez votre HTML/CSS ici puis cliquez sur Importer',
  },
  pt: {
    extraCategory: 'Extra',
    typedStrings: ['Linha de texto um', 'Linha de texto dois', 'Linha de texto tres'],
    importTemplateTitle: 'Importar template',
    importTemplateLabel: 'Cole aqui seu HTML/CSS e clique em Importar',
  },
};

function normalizeLocale(locale?: string): SupportedLocale {
  const lower = String(locale ?? '').toLowerCase();
  if (lower.startsWith('fr')) return 'fr';
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('pt')) return 'pt';
  return 'en';
}

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
  const { canvasStyles = [], assetBaseUrl, assetUrls: assetUrlsOpt, locale } = options;
  const assetUrls = assetUrlsOpt ?? defaultAssets(assetBaseUrl);
  const normalizedLocale = normalizeLocale(locale);
  const coreLocale = localeByCode[normalizedLocale];
  const pluginLocale = pluginLocaleByCode[normalizedLocale];

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
    i18n: {
      locale: normalizedLocale,
      localeFallback: 'en',
      messages: {
        [normalizedLocale]: coreLocale,
      },
    },
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
      'grapesjs-tabs': { tabsBlock: { category: pluginLocale.extraCategory } },
      'grapesjs-typed': {
        block: {
          category: pluginLocale.extraCategory,
          content: {
            type: 'typed',
            'type-speed': 40,
            strings: pluginLocale.typedStrings,
          },
        },
      },
      'grapesjs-preset-webpage': {
        modalImportTitle: pluginLocale.importTemplateTitle,
        modalImportLabel: pluginLocale.importTemplateLabel,
        modalImportContent: (editor: import('grapesjs').Editor) => `${editor.getHtml()} ${editor.getCss()}`,
      },
    },
  };
}
