import React, { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function DeleteMyData() {
  const [step, setStep] = useState<"form" | "done" | "error">("form");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [provider, setProvider] = useState("google");
  const { t } = useTranslation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("email", email);

      const res = await fetch("/api/v1/webhooks/request-deletion-public", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || t('pages.deleteMyData.serverError'));
      }

      setConfirmCode(data.confirmation_code || "");
      setStep("done");
    } catch (err: unknown) {
      setErrorMsg(t('pages.deleteMyData.serverError'));
      setStep("error");
    } finally {
      setLoading(false);
    }
  }

  const colors = {
    terracotta: "#c0704a",
    terracottaDark: "#a05a38",
    terracottaLight: "#f5e6dc",
    warmBrown: "#5c3d2e",
    pampas: "#f4ede8",
    white: "#ffffff",
    cloudy: "#9e9e9e",
    border: "#ddd",
    textMuted: "#666",
    radius: "12px",
  };

  if (step === "done") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: `linear-gradient(135deg, ${colors.terracottaLight} 0%, ${colors.pampas} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            maxWidth: "500px",
            width: "100%",
            background: colors.white,
            borderRadius: colors.radius,
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            padding: "40px",
            textAlign: "center",
          }}
        >
          <div style={{ marginBottom: "24px" }}>
            <CheckCircle2
              size={64}
              color="#2a9d4e"
              style={{ margin: "0 auto" }}
            />
          </div>
          <h2
            style={{
              color: colors.warmBrown,
              fontSize: "24px",
              fontWeight: 600,
              marginBottom: "16px",
            }}
          >
            {t('pages.deleteMyData.successTitle')}
          </h2>
          <p style={{ color: colors.textMuted, marginBottom: "16px" }}>
            {t('pages.deleteMyData.successDesc')}
          </p>
          <div
            style={{
              background: colors.pampas,
              padding: "16px",
              borderRadius: "8px",
              marginBottom: "16px",
              fontFamily: "monospace",
              fontSize: "14px",
            }}
          >
            <p style={{ color: colors.textMuted, marginBottom: "8px" }}>
              {t('pages.deleteMyData.confirmCode')}
            </p>
            <p style={{ color: colors.warmBrown, fontWeight: "bold" }}>
              {confirmCode}
            </p>
          </div>
          <p style={{ color: colors.textMuted, fontSize: "14px" }}>
            {t('pages.deleteMyData.successNote')}
          </p>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: `linear-gradient(135deg, ${colors.terracottaLight} 0%, ${colors.pampas} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            maxWidth: "500px",
            width: "100%",
            background: colors.white,
            borderRadius: colors.radius,
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            padding: "40px",
          }}
        >
          <div style={{ marginBottom: "24px", textAlign: "center" }}>
            <AlertCircle
              size={64}
              color={colors.terracotta}
              style={{ margin: "0 auto" }}
            />
          </div>
          <h2
            style={{
              color: colors.warmBrown,
              fontSize: "24px",
              fontWeight: 600,
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            {t('pages.deleteMyData.errorTitle')}
          </h2>
          <p
            style={{
              color: colors.textMuted,
              marginBottom: "24px",
              textAlign: "center",
            }}
          >
            {errorMsg || t('pages.deleteMyData.errorFallback')}
          </p>
          <button
            onClick={() => {
              setStep("form");
              setEmail("");
              setErrorMsg("");
            }}
            style={{
              width: "100%",
              background: colors.terracotta,
              color: colors.white,
              padding: "12px",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "16px",
              transition: "background 0.3s",
            }}
            onMouseOver={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                colors.terracottaDark)
            }
            onMouseOut={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                colors.terracotta)
            }
          >
            {t('pages.deleteMyData.btnRetry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(135deg, ${colors.terracottaLight} 0%, ${colors.pampas} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          maxWidth: "500px",
          width: "100%",
          background: colors.white,
          borderRadius: colors.radius,
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          padding: "40px",
        }}
      >
        <h1
          style={{
            color: colors.terracotta,
            fontSize: "24px",
            fontWeight: 600,
            marginBottom: "16px",
          }}
        >
          {t('pages.deleteMyData.title')}
        </h1>
        <p style={{ color: colors.textMuted, marginBottom: "16px" }}>
          {t('pages.deleteMyData.subtitle')}
        </p>

        <div
          style={{
            background: "#fff3e0",
            borderLeft: `4px solid ${colors.terracotta}`,
            padding: "16px",
            marginBottom: "24px",
            borderRadius: "4px",
            color: colors.terracottaDark,
            fontSize: "14px",
          }}
        >
          {t('pages.deleteMyData.warning')}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                color: colors.warmBrown,
                fontWeight: 500,
                marginBottom: "8px",
              }}
            >
              {t('pages.deleteMyData.labelEmail')}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              style={{
                width: "100%",
                padding: "12px",
                border: `1px solid ${colors.border}`,
                borderRadius: "8px",
                fontFamily: "inherit",
                fontSize: "14px",
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                color: colors.warmBrown,
                fontWeight: 500,
                marginBottom: "8px",
              }}
            >
              {t('pages.deleteMyData.labelProvider')}
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                border: `1px solid ${colors.border}`,
                borderRadius: "8px",
                fontFamily: "inherit",
                fontSize: "14px",
              }}
            >
              <option value="google">Google</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: loading ? colors.cloudy : colors.terracotta,
              color: colors.white,
              padding: "12px",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "16px",
              transition: "background 0.3s",
            }}
            onMouseOver={(e) => {
              if (!loading)
                (e.currentTarget as HTMLButtonElement).style.background =
                  colors.terracottaDark;
            }}
            onMouseOut={(e) => {
              if (!loading)
                (e.currentTarget as HTMLButtonElement).style.background =
                  colors.terracotta;
            }}
          >
            {loading ? t('pages.deleteMyData.btnSubmitting') : t('pages.deleteMyData.btnSubmit')}
          </button>

          <p style={{ fontSize: "12px", color: colors.cloudy, marginTop: "12px" }}>
            {t('pages.deleteMyData.confirmationNote')}
          </p>
        </form>
      </div>
    </div>
  );
}
