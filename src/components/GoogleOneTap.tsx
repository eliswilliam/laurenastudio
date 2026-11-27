import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? "";

interface PromptNotification {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: object) => void;
          prompt: (cb?: (n: PromptNotification) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

function initGSI(autoSelect: boolean) {
  if (!window.google?.accounts?.id || !CLIENT_ID) return false;
  window.google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredential,
    auto_select: autoSelect,
    itp_support: true,
    use_fedcm_for_prompt: autoSelect,
  });
  return true;
}

export function triggerGoogleSignIn() {
  function doPrompt() {
    if (!initGSI(false)) {
      window.location.href = "/login";
      return;
    }
    window.google!.accounts.id.prompt((n) => {
      if (n.isNotDisplayed() || n.isSkippedMoment()) {
        window.location.href = "/login";
      }
    });
  }

  if (window.google?.accounts?.id) {
    doPrompt();
  } else {
    const script = document.querySelector<HTMLScriptElement>(
      'script[src*="accounts.google.com/gsi/client"]'
    );
    if (script) {
      script.addEventListener("load", doPrompt, { once: true });
    } else {
      window.location.href = "/login";
    }
  }
}

export default function GoogleOneTap() {
  const isAutenticado = useAuthStore((s: { isAutenticado: boolean }) => s.isAutenticado);

  useEffect(() => {
    if (isAutenticado || !CLIENT_ID) return;

    function init() {
      if (!initGSI(true)) return;
      window.google!.accounts.id.prompt();
    }

    if (window.google?.accounts?.id) {
      init();
    } else {
      const script = document.querySelector<HTMLScriptElement>(
        'script[src*="accounts.google.com/gsi/client"]'
      );
      if (script) {
        script.addEventListener("load", init, { once: true });
      }
    }

    return () => {
      window.google?.accounts?.id.cancel();
    };
  }, [isAutenticado]);

  return null;
}

async function handleCredential(response: { credential: string }) {
  const res = await fetch("/api/v1/auth/google/one-tap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential: response.credential }),
    credentials: "include",
  }).catch(() => null);

  if (!res?.ok) {
    console.error("One Tap auth failed:", await res?.text());
    return;
  }

  window.location.href = "/auth/callback";
}
