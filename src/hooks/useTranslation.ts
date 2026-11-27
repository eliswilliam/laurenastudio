import { useTranslation as useI18nTranslation } from 'react-i18next';

/**
 * Hook personnalisé pour utiliser les traductions dans les composants React
 *
 * Utilisation:
 * const { t, i18n } = useTranslation();
 *
 * Exemples:
 * - t('auth.login') -> "Entrar" (pt-BR) / "Login" (en)
 * - i18n.language -> "pt-BR" (langue actuelle)
 * - i18n.changeLanguage('en') -> Change la langue en anglais
 */
export function useTranslation() {
  return useI18nTranslation();
}

export default useTranslation;
