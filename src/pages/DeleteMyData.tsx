import { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function DeleteMyData() {
  const [step, setStep] = useState<"form" | "done" | "error">("form");
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState("google");
  const [loading, setLoading] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/webhooks/request-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, provider }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Erreur serveur");
      }

      setConfirmCode(data.confirmation_code);
      setStep("done");
    } catch (err: any) {
      setErrorMsg(err.message);
      setStep("error");
    } finally {
      setLoading(false);
    }
  }

  // Style tokens — utilise les couleurs de Laurena Studio
  const colors = {
    terracotta: "#C15F3C",
    terracottaDark: "#9a3f20",
    terracottaLight: "#f0e4dd",
    pampas: "#F4F3EE",
    warmBrown: "#2a1a10",
    cloudy: "#B1ADA1",
    textMuted: "#7a7168",
    white: "#FFFFFF",
    border: "#d4cfc6",
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
            Demande enregistrée
          </h2>
          <p style={{ color: colors.textMuted, marginBottom: "16px" }}>
            Votre demande de suppression a été reçue et traitée.
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
              Code de confirmation
            </p>
            <p style={{ color: colors.warmBrown, fontWeight: "bold" }}>
              {confirmCode}
            </p>
          </div>
          <p style={{ color: colors.textMuted, fontSize: "14px" }}>
            Vos données seront supprimées sous <strong>30 jours</strong> conformément au RGPD.
            Un email de confirmation a été envoyé.
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
            Une erreur est survenue
          </h2>
          <p
            style={{
              color: colors.textMuted,
              marginBottom: "24px",
              textAlign: "center",
            }}
          >
            {errorMsg || "Veuillez réessayer ou contacter le support."}
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
            Réessayer
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
          Supprimer mes données
        </h1>
        <p style={{ color: colors.textMuted, marginBottom: "16px" }}>
          Soumettez ce formulaire pour demander la suppression de toutes vos données personnelles.
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
          <strong>⚠️ Attention :</strong> Cette action est irréversible. Toutes vos données
          seront supprimées sous 30 jours.
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
              Adresse email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
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
              Connecté via
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
            {loading ? "Envoi en cours..." : "Demander la suppression"}
          </button>

          <p style={{ fontSize: "12px", color: colors.cloudy, marginTop: "12px" }}>
            Vous recevrez un email de confirmation.
          </p>
        </form>
      </div>
    </div>
  );
}
