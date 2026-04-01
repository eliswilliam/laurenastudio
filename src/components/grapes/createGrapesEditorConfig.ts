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
  importTemplateButton: string;
  clearCanvasText: string;
  basicCategory: string;
  basicBlocks: {
    column1: string;
    column2: string;
    column3: string;
    column37: string;
    text: string;
    link: string;
    image: string;
    video: string;
    map: string;
  };
  webpageBlocks: {
    linkBlock: string;
    quote: string;
    textSection: string;
  };
}> = {
  en: {
    extraCategory: 'Extra',
    typedStrings: ['Text row one', 'Text row two', 'Text row three'],
    importTemplateTitle: 'Import Template',
    importTemplateLabel: 'Paste your HTML/CSS here and click Import',
    importTemplateButton: 'Import',
    clearCanvasText: 'Are you sure you want to clear the canvas?',
    basicCategory: 'Basic',
    basicBlocks: {
      column1: '1 Column',
      column2: '2 Columns',
      column3: '3 Columns',
      column37: '2 Columns 3/7',
      text: 'Text',
      link: 'Link',
      image: 'Image',
      video: 'Video',
      map: 'Map',
    },
    webpageBlocks: {
      linkBlock: 'Link Block',
      quote: 'Quote',
      textSection: 'Text section',
    },
  },
  es: {
    extraCategory: 'Extra',
    typedStrings: ['Linea de texto uno', 'Linea de texto dos', 'Linea de texto tres'],
    importTemplateTitle: 'Importar plantilla',
    importTemplateLabel: 'Pega aqui tu HTML/CSS y haz clic en Importar',
    importTemplateButton: 'Importar',
    clearCanvasText: 'Estas seguro de que deseas limpiar el lienzo?',
    basicCategory: 'Basico',
    basicBlocks: {
      column1: '1 Columna',
      column2: '2 Columnas',
      column3: '3 Columnas',
      column37: '2 Columnas 3/7',
      text: 'Texto',
      link: 'Enlace',
      image: 'Imagen',
      video: 'Video',
      map: 'Mapa',
    },
    webpageBlocks: {
      linkBlock: 'Bloque de enlace',
      quote: 'Cita',
      textSection: 'Seccion de texto',
    },
  },
  fr: {
    extraCategory: 'Extra',
    typedStrings: ['Ligne de texte une', 'Ligne de texte deux', 'Ligne de texte trois'],
    importTemplateTitle: 'Importer un template',
    importTemplateLabel: 'Collez votre HTML/CSS ici puis cliquez sur Importer',
    importTemplateButton: 'Importer',
    clearCanvasText: 'Voulez-vous vraiment vider le canevas ?',
    basicCategory: 'Base',
    basicBlocks: {
      column1: '1 Colonne',
      column2: '2 Colonnes',
      column3: '3 Colonnes',
      column37: '2 Colonnes 3/7',
      text: 'Texte',
      link: 'Lien',
      image: 'Image',
      video: 'Video',
      map: 'Carte',
    },
    webpageBlocks: {
      linkBlock: 'Bloc lien',
      quote: 'Citation',
      textSection: 'Section texte',
    },
  },
  pt: {
    extraCategory: 'Extra',
    typedStrings: ['Linha de texto um', 'Linha de texto dois', 'Linha de texto tres'],
    importTemplateTitle: 'Importar template',
    importTemplateLabel: 'Cole aqui seu HTML/CSS e clique em Importar',
    importTemplateButton: 'Importar',
    clearCanvasText: 'Tem certeza de que deseja limpar a tela?',
    basicCategory: 'Basico',
    basicBlocks: {
      column1: '1 Coluna',
      column2: '2 Colunas',
      column3: '3 Colunas',
      column37: '2 Colunas 3/7',
      text: 'Texto',
      link: 'Link',
      image: 'Imagem',
      video: 'Video',
      map: 'Mapa',
    },
    webpageBlocks: {
      linkBlock: 'Bloco de link',
      quote: 'Citacao',
      textSection: 'Secao de texto',
    },
  },
};

const localeOverrides: Record<SupportedLocale, Record<string, unknown>> = {
  en: {
    styleManager: {
      empty: 'Select an element before using Style Manager',
    },
    traitManager: {
      empty: 'Select an element before using Trait Manager',
      label: 'Component settings',
    },
  },
  es: {
    styleManager: {
      empty: 'Selecciona un elemento antes de usar el gestor de estilos',
    },
    traitManager: {
      empty: 'Selecciona un elemento antes de usar el gestor de atributos',
      label: 'Configuracion del componente',
    },
  },
  fr: {
    styleManager: {
      empty: 'Selectionnez un element avant d\'utiliser le gestionnaire de styles',
    },
    traitManager: {
      empty: 'Selectionnez un element avant d\'utiliser le gestionnaire de proprietes',
      label: 'Parametres du composant',
    },
  },
  pt: {
    styleManager: {
      empty: 'Selecione um elemento antes de usar o gerenciador de estilos',
    },
    traitManager: {
      empty: 'Selecione um elemento antes de usar o gerenciador de atributos',
      label: 'Configuracoes do componente',
    },
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

  const i18nMessages = {
    ...coreLocale,
    ...localeOverrides[normalizedLocale],
  };

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
        en: {
          ...(localeByCode.en as Record<string, unknown>),
          ...localeOverrides.en,
        },
        es: {
          ...(localeByCode.es as Record<string, unknown>),
          ...localeOverrides.es,
        },
        fr: {
          ...(localeByCode.fr as Record<string, unknown>),
          ...localeOverrides.fr,
        },
        pt: {
          ...(localeByCode.pt as Record<string, unknown>),
          ...localeOverrides.pt,
        },
        [normalizedLocale]: i18nMessages,
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
      'gjs-blocks-basic': {
        flexGrid: true,
        category: pluginLocale.basicCategory,
        labelColumn1: pluginLocale.basicBlocks.column1,
        labelColumn2: pluginLocale.basicBlocks.column2,
        labelColumn3: pluginLocale.basicBlocks.column3,
        labelColumn37: pluginLocale.basicBlocks.column37,
        labelText: pluginLocale.basicBlocks.text,
        labelLink: pluginLocale.basicBlocks.link,
        labelImage: pluginLocale.basicBlocks.image,
        labelVideo: pluginLocale.basicBlocks.video,
        labelMap: pluginLocale.basicBlocks.map,
      },
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
        useCustomTheme: false,
        modalImportTitle: pluginLocale.importTemplateTitle,
        modalImportLabel: pluginLocale.importTemplateLabel,
        modalImportButton: pluginLocale.importTemplateButton,
        textCleanCanvas: pluginLocale.clearCanvasText,
        block: (id: string) => {
          if (id === 'link-block') return { label: pluginLocale.webpageBlocks.linkBlock };
          if (id === 'quote') return { label: pluginLocale.webpageBlocks.quote };
          if (id === 'text-basic') return { label: pluginLocale.webpageBlocks.textSection };
          return {};
        },
        modalImportContent: (editor: import('grapesjs').Editor) => `${editor.getHtml()} ${editor.getCss()}`,
      },
    },
  };
}
