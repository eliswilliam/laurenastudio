import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import ptBR from './locales/pt-BR.json'
import ptBRPages from './locales/pt-BR-pages.json'
import en from './locales/en.json'
import enPages from './locales/en-pages.json'
import es from './locales/es.json'
import esPages from './locales/es-pages.json'
import fr from './locales/fr.json'
import frPages from './locales/fr-pages.json'

const merge = <T extends Record<string, unknown>, U extends Record<string, unknown>>(a: T, b: U) =>
  ({ ...a, ...b }) as T & U

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': { translation: merge(ptBR as Record<string, unknown>, ptBRPages as Record<string, unknown>) },
      pt: { translation: merge(ptBR as Record<string, unknown>, ptBRPages as Record<string, unknown>) },
      en: { translation: merge(en as Record<string, unknown>, enPages as Record<string, unknown>) },
      'en-US': { translation: merge(en as Record<string, unknown>, enPages as Record<string, unknown>) },
      'en-GB': { translation: merge(en as Record<string, unknown>, enPages as Record<string, unknown>) },
      es: { translation: merge(es as Record<string, unknown>, esPages as Record<string, unknown>) },
      'es-ES': { translation: merge(es as Record<string, unknown>, esPages as Record<string, unknown>) },
      'es-419': { translation: merge(es as Record<string, unknown>, esPages as Record<string, unknown>) },
      fr: { translation: merge(fr as Record<string, unknown>, frPages as Record<string, unknown>) },
      'fr-FR': { translation: merge(fr as Record<string, unknown>, frPages as Record<string, unknown>) },
    },
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'pt', 'en', 'en-US', 'en-GB', 'es', 'es-ES', 'es-419', 'fr', 'fr-FR'],
    nonExplicitSupportedLngs: true,
    load: 'currentOnly',
    detection: {
      // Préférence enregistrée (sélecteur) puis navigateur si aucune clé — toutes les pages utilisent les mêmes clés i18n.
      order: ['localStorage', 'navigator', 'htmlTag', 'cookie'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: {
      escapeValue: false,
    },
  })

function syncDocumentLang(lng: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng
  }
}

syncDocumentLang(i18n.language)
i18n.on('languageChanged', syncDocumentLang)

export default i18n
