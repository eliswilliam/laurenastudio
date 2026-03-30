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
    detection: {
      order: ['navigator', 'htmlTag', 'localStorage', 'cookie'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
