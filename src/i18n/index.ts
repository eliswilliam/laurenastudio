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
  'pt': { translation: ptBR }, // Alias pour pt → pt-BR
  'en': { translation: en },
  'en-US': { translation: en }, // Alias pour en-US → en
  'es': { translation: es },
  'es-ES': { translation: es }, // Alias pour es-ES → es
  'fr': { translation: fr },
  'fr-FR': { translation: fr }, // Alias pour fr-FR → fr
};

i18n
  .use(LanguageDetector) // Détecte la langue du navigateur
  .use(initReactI18next) // Passe i18n à react-i18next
  .init({
    resources,
    fallbackLng: 'pt-BR', // Langue par défaut
    debug: true, // Active le debug pour voir ce qui se passe

    // Configuration du détecteur de langue
    detection: {
      // Ordre de détection: navigateur d'abord, puis localStorage
      order: ['navigator', 'localStorage', 'htmlTag', 'cookie'],

      // Cache dans le localStorage
      caches: ['localStorage'],

      // Clé utilisée pour stocker la langue dans localStorage
      lookupLocalStorage: 'i18nextLng',

      // Clé utilisée pour stocker la langue dans les cookies
      lookupCookie: 'i18nextLng',

      // Convertit les codes de langue (ex: en-US → en)
      convertDetectedLanguage: (lng: string) => {
        // Convertit les codes longs vers les codes courts
        const languageMap: Record<string, string> = {
          'pt-BR': 'pt-BR',
          'pt': 'pt-BR',
          'en-US': 'en',
          'en-GB': 'en',
          'en': 'en',
          'es-ES': 'es',
          'es-MX': 'es',
          'es': 'es',
          'fr-FR': 'fr',
          'fr-CA': 'fr',
          'fr': 'fr',
        };

        // Essaie d'abord le code complet, puis le code court
        if (languageMap[lng]) {
          return languageMap[lng];
        }

        // Si pas trouvé, essaie juste le code de langue (avant le -)
        const shortLang = lng.split('-')[0];
        return languageMap[shortLang] || 'pt-BR';
      },
    },

    interpolation: {
      escapeValue: false, // React échappe déjà les valeurs
    },

    // Charge toutes les variantes (pt-BR, en-US, etc.)
    load: 'all',

    // Langues supportées
    supportedLngs: ['pt-BR', 'pt', 'en', 'en-US', 'es', 'es-ES', 'fr', 'fr-FR'],

    // Permet les correspondances non explicites
    nonExplicitSupportedLngs: true,
  });

export default i18n;
