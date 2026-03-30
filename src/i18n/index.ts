import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import ptBR from './locales/pt-BR.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': { translation: ptBR },
      pt: { translation: ptBR },
      en: { translation: en },
      'en-US': { translation: en },
      'en-GB': { translation: en },
      es: { translation: es },
      'es-ES': { translation: es },
      'es-419': { translation: es },
      fr: { translation: fr },
      'fr-FR': { translation: fr },
    },
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'pt', 'en', 'en-US', 'en-GB', 'es', 'es-ES', 'es-419', 'fr', 'fr-FR'],
    nonExplicitSupportedLngs: true,
    load: 'currentOnly',
    detection: {
      // localStorage d'abord si l'utilisateur a déjà choisi une langue ; sinon la langue du navigateur
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
