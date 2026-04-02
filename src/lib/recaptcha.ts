type GrecaptchaLike = {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: GrecaptchaLike;
  }
}

const RECAPTCHA_SCRIPT_ID = "recaptcha-v3-script";
const RECAPTCHA_SITE_KEY = (
  import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6LcJ7aMsAAAAAJY719JgPDEoNukJHAvvKB4_9Um3"
).trim();

let scriptPromise: Promise<void> | null = null;

function loadRecaptchaScript(siteKey: string): Promise<void> {
  if (window.grecaptcha) {
    return Promise.resolve();
  }
  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(RECAPTCHA_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load reCAPTCHA.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = RECAPTCHA_SCRIPT_ID;
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA."));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function executeRecaptchaAction(action: string): Promise<string> {
  if (!RECAPTCHA_SITE_KEY) {
    throw new Error("reCAPTCHA site key not configured.");
  }

  await loadRecaptchaScript(RECAPTCHA_SITE_KEY);

  if (!window.grecaptcha) {
    throw new Error("reCAPTCHA is not available.");
  }

  const token = await new Promise<string>((resolve, reject) => {
    window.grecaptcha?.ready(() => {
      window.grecaptcha
        ?.execute(RECAPTCHA_SITE_KEY, { action })
        .then((value) => {
          if (!value) {
            reject(new Error("reCAPTCHA token is empty."));
            return;
          }
          resolve(value);
        })
        .catch(() => reject(new Error("reCAPTCHA execution failed.")));
    });
  });

  return token;
}
