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
