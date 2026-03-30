import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

const resources = {
  'pt-BR': { translation: ptBR },
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
};

i18n
  .use(LanguageDetector) // Détecte la langue du navigateur
  .use(initReactI18next) // Passe i18n à react-i18next
  .init({
    resources,
    fallbackLng: 'pt-BR', // Langue par défaut
    debug: false, // Mettre à true pour déboguer

    // Configuration du détecteur de langue
    detection: {
      // Ordre de détection: navigateur -> balise HTML -> localStorage -> cookie
      order: ['navigator', 'htmlTag', 'localStorage', 'cookie'],

      // Cache dans le localStorage
      caches: ['localStorage'],

      // Clé utilisée pour stocker la langue dans localStorage
      lookupLocalStorage: 'i18nextLng',

      // Clé utilisée pour stocker la langue dans les cookies
      lookupCookie: 'i18nextLng',
    },

    interpolation: {
      escapeValue: false, // React échappe déjà les valeurs
    },

    // Support des langues avec code pays (pt-BR) et sans (pt)
    load: 'languageOnly', // Charge 'pt' pour 'pt-BR', 'en' pour 'en-US', etc.

    // Map des langues alternatives
    supportedLngs: ['pt-BR', 'pt', 'en', 'es', 'fr'],

    // Règles de correspondance des langues
    nonExplicitSupportedLngs: true,
  });

export default i18n;
