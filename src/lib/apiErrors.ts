/**
 * Maps backend error codes to i18n translation keys.
 * Backend always returns codes like "INVALID_CREDENTIALS".
 * Frontend translates via t('errors.<code>').
 */

const ERROR_CODES = new Set([
  // Auth
  "INVALID_CREDENTIALS",
  "EMAIL_ALREADY_EXISTS",
  "ACCOUNT_DEACTIVATED",
  "PASSWORD_TOO_SHORT",
  "CURRENT_PASSWORD_REQUIRED",
  "CURRENT_PASSWORD_WRONG",
  "RESET_CODE_INVALID",
  "RESET_CODE_EXPIRED",
  "RESET_EMAIL_SENT",
  "PASSWORD_UPDATED",
  "RESET_CODE_VALID",
  "AVATAR_INVALID_TYPE",
  "AVATAR_TOO_LARGE",
  "AVATAR_CONTENT_MISMATCH",
  "AVATAR_UPLOAD_FAILED",
  "TOO_MANY_ATTEMPTS",
  "RECAPTCHA_FAILED",
  "RECAPTCHA_UNAVAILABLE",
  "RECAPTCHA_REQUIRED",
  "RECAPTCHA_CONFIG_INVALID",
  // Media
  "FILE_TYPE_NOT_ALLOWED",
  "FILE_TOO_LARGE",
  "FILE_CONTENT_MISMATCH",
  // AI / Speech
  "SPEECH_SERVICE_UNAVAILABLE",
  "SPEECH_SYNTHESIS_FAILED",
  "AI_GENERATION_FAILED",
  "IMAGE_REQUIRED_FOR_VIDEO",
  "AI_SERVICE_UNAVAILABLE",
  "IMAGE_GENERATION_FAILED",
  // Projects / Sites
  "PROJECT_NOT_FOUND",
  "NOTIFICATION_NOT_FOUND",
  "NAME_ALREADY_USED",
  "USER_NOT_FOUND",
]);

export function isErrorCode(value: string): boolean {
  return ERROR_CODES.has(value);
}

type TFunction = (key: string, options?: { defaultValue: string }) => string;

/**
 * Translate a backend detail string.
 * If it's a known code, returns the i18n translation.
 * Otherwise returns the raw string (legacy / unknown errors).
 */
export function translateApiError(detail: string, t: TFunction): string {
  if (isErrorCode(detail)) {
    return t(`errors.${detail}`, { defaultValue: detail });
  }
  return detail;
}
