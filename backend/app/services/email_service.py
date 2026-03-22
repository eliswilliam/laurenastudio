"""
email_service.py — Sends transactional e-mails via Gmail SMTP (TLS, port 587).

Usage:
    await send_password_reset_code(to_email="user@example.com", code="123456")

Set the following environment variables (or .env):
    SMTP_USERNAME   — your Gmail address  (e.g. noreply@gmail.com)
    SMTP_PASSWORD   — Gmail App Password  (16-char, no spaces)
    SMTP_FROM_EMAIL — sender address (defaults to SMTP_USERNAME if empty)
    SMTP_FROM_NAME  — friendly sender name
"""
import asyncio
import html
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


def _send_email_sync(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    """Blocking send — runs in a thread pool to avoid blocking the event loop."""
    from_addr = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{from_addr}>"
    msg["To"] = to_email

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.sendmail(from_addr, [to_email], msg.as_string())


async def send_password_reset_code(to_email: str, code: str) -> None:
    """Send a 6-digit password-reset code to *to_email*."""
    subject = "Seu código de recuperação de senha — Laurena Studio"

    html_body = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:480px;margin:0 auto;padding:24px">
  <img src="{settings.FRONTEND_URL}/android-chrome-192x192.png" alt="Laurena Studio"
       width="48" style="border-radius:12px;margin-bottom:16px">
  <h2 style="margin:0 0 8px">Recuperação de senha</h2>
  <p style="color:#555;margin:0 0 24px">
    Use o código abaixo para redefinir sua senha. Ele é válido por <strong>10 minutos</strong>.
  </p>
  <div style="background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;
              font-size:36px;font-weight:bold;letter-spacing:12px;color:#C15F3C">
    {code}
  </div>
  <p style="color:#888;font-size:12px;margin-top:24px">
    Se você não solicitou a recuperação de senha, ignore este e-mail.
  </p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
  <p style="color:#999;font-size:11px;margin:0">
    © Laurena Studio — todos os direitos reservados.
  </p>
</body>
</html>
"""

    text_body = (
        f"Código de recuperação de senha: {code}\n"
        f"Válido por 10 minutos.\n\n"
        f"Se você não solicitou, ignore este e-mail."
    )

    # If SMTP is not configured, log the code and skip silently (dev mode)
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        import logging
        logging.getLogger(__name__).warning(
            "SMTP not configured — reset code for %s is: %s", to_email, code
        )
        return

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _send_email_sync, to_email, subject, html_body, text_body)


def _format_plan_cards_html(
    plans: list[tuple[str, str, str, str]],
) -> str:
    """(display_name, price_fmt, internal_name, tagline) → blocos HTML."""
    blocks: list[str] = []
    accent = "#C15F3C"
    border = "#e8e4e0"
    for display_name, price_fmt, _name, tagline in plans:
        dn = html.escape(display_name, quote=True)
        tg = html.escape(tagline, quote=True)
        blocks.append(
            f"""
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:14px;border:1px solid {border};border-radius:14px;overflow:hidden;background:#faf9f8">
    <tr>
      <td style="padding:18px 20px">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:{accent}">Plano</p>
        <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a1a">{dn}</h3>
        <p style="margin:0 0 10px;font-size:22px;font-weight:700;color:#1a1a1a">{html.escape(price_fmt, quote=True)}<span style="font-size:13px;font-weight:500;color:#666"> /mês</span></p>
        <p style="margin:0;font-size:14px;line-height:1.55;color:#444">{tg}</p>
      </td>
    </tr>
  </table>"""
        )
    return "\n".join(blocks) if blocks else "<p style='color:#666'>Consulte os planos no site.</p>"


async def send_welcome_email(
    to_email: str,
    recipient_name: str,
    plans: list[tuple[str, str, str, str]],
) -> bool:
    """
    E-mail de boas-vindas (identidade Laurena: coral #C15F3C, tipografia sans-serif).
    plans: lista de (display_name, preço formatado, name interno, tagline curta).
    """
    subject = "Bem-vindo à Laurena Studio — sua criatividade, amplificada por IA"

    logo_url = f"{settings.FRONTEND_URL.rstrip('/')}/android-chrome-192x192.png"
    plans_url = f"{settings.FRONTEND_URL.rstrip('/')}/escolher-plano"
    dashboard_url = f"{settings.FRONTEND_URL.rstrip('/')}/dashboard"

    safe_name = html.escape(recipient_name, quote=True)
    cards = _format_plan_cards_html(plans)

    html_body = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f0eeeb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f0eeeb;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(26,26,26,0.08)">
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a1a 0%,#2d2419 50%,#4a2f22 100%);padding:28px 28px 24px;text-align:center">
              <img src="{logo_url}" alt="Laurena Studio" width="56" height="56" style="border-radius:14px;display:block;margin:0 auto 12px">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.35em;text-transform:uppercase;color:rgba(255,255,255,0.75)">LAURENA STUDIO</p>
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3">Bem-vindo, {safe_name}!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#333">
                Obrigado por entrar na <strong style="color:#C15F3C">Laurena Studio</strong> — a plataforma pensada para
                <strong>criadores, marcas e equipas</strong> que querem produzir conteúdo de marketing com inteligência artificial:
                textos, imagens e vídeo, agendamento, biblioteca de mídia e o nosso gerador de sites, tudo num só lugar.
              </p>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#333">
                Explore o <strong>dashboard</strong>, experimente o <strong>AI Studio</strong> e escolha o plano que melhor se adapta ao seu ritmo.
              </p>
              <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#888">Os nossos planos</p>
              {cards}
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0 8px">
                <tr>
                  <td align="center">
                    <a href="{plans_url}" style="display:inline-block;background:#C15F3C;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:999px">Ver planos e preços</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:12px">
                    <a href="{dashboard_url}" style="color:#C15F3C;font-size:14px;font-weight:500;text-decoration:underline">Abrir o painel</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px">
              <hr style="border:none;border-top:1px solid #e8e4e0;margin:0 0 16px">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#888;text-align:center">
                Recebeu este e-mail porque acabou de iniciar sessão ou criar conta na Laurena Studio.<br>
                Se não foi você, pode ignorar esta mensagem com segurança.
              </p>
              <p style="margin:16px 0 0;font-size:11px;color:#aaa;text-align:center">© Laurena Studio — todos os direitos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    plan_lines_txt = "\n".join(
        f"- {d[0]} ({d[1]}/mês): {d[3]}" for d in plans
    ) or "Consulte /escolher-plano no site."

    text_body = (
        f"Olá, {recipient_name}!\n\n"
        "Bem-vindo à Laurena Studio — plataforma de marketing com IA (texto, imagem, vídeo), "
        "agendamento, mídia e criação de sites.\n\n"
        "Planos:\n"
        f"{plan_lines_txt}\n\n"
        f"Ver planos: {plans_url}\n"
        f"Painel: {dashboard_url}\n"
    )

    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        import logging

        logging.getLogger(__name__).warning(
            "SMTP not configured — welcome e-mail skipped for %s", to_email
        )
        return False

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _send_email_sync, to_email, subject, html_body, text_body)
    return True
