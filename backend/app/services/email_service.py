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

    base_url = settings.FRONTEND_URL.rstrip('/')
    if "localhost" in base_url or "127.0.0.1" in base_url:
        base_url = "https://studiolaurena-g8eadbcrg8a9hyeq.canadacentral-01.azurewebsites.net"
        
    html_body = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;background:#f9f9fa;margin:0;padding:40px 20px">
  <table width="100%" max-width="500" cellpadding="0" cellspacing="0" style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.06);overflow:hidden">
    <tr>
      <td style="padding:40px 32px;text-align:center;">
        <img src="{base_url}/android-chrome-192x192.png" alt="Laurena Studio" width="56" style="border-radius:12px;margin-bottom:24px">
        <h2 style="margin:0 0 12px;font-size:22px;color:#1a1a1a">Recuperação de Senha</h2>
        <p style="color:#555;margin:0 0 32px;font-size:15px;line-height:1.5">
          Use o código abaixo para redefinir sua senha na Laurena Studio. Ele é válido por <strong>10 minutos</strong>.
        </p>
        <div style="background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;font-size:36px;font-weight:700;letter-spacing:8px;color:#C15F3C;margin-bottom:32px;">
          {code}
        </div>
        <p style="color:#888;font-size:13px;margin:0;line-height:1.5">
          Se você não solicitou a recuperação de senha, pode ignorar este e-mail tranquilamente.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#fcfcfc;padding:24px 32px;text-align:center;border-top:1px solid #eee">
        <p style="color:#aaa;font-size:12px;margin:0">
          © Laurena Studio — todos os direitos reservados.
        </p>
      </td>
    </tr>
  </table>
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

base_url = settings.FRONTEND_URL.rstrip('/')
    if "localhost" in base_url or "127.0.0.1" in base_url:
        base_url = "https://studiolaurena-g8eadbcrg8a9hyeq.canadacentral-01.azurewebsites.net"

    logo_url = f"{base_url}/android-chrome-192x192.png"
    plans_url = f"{base_url}/escolher-plano"
    dashboard_url = f"{base_url}/dashboard"

    safe_name = html.escape(recipient_name, quote=True)
    cards = _format_plan_cards_html(plans)

    html_body = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f9f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;padding:40px 20px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.06)">
    <tr>
      <td style="padding:48px 40px 32px;text-align:center;background:#fff;border-bottom:1px solid #f0f0f0">
        <img src="{logo_url}" alt="Laurena Studio" width="64" height="64" style="border-radius:16px;display:block;margin:0 auto 20px">
        <h1 style="margin:0;font-size:26px;font-weight:800;color:#1a1a1a;letter-spacing:-0.5px">Bem-vindo(a), {safe_name}! 🎉</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:40px 40px 24px">
        <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#444">
          É um prazer ter você na <strong>Laurena Studio</strong>. Nossa plataforma foi desenhada para impulsionar a sua criatividade com ferramentas de Inteligência Artificial para gerar sites, criar textos, imagens, vídeos e gerir redes sociais.
        </p>
        <p style="margin:0 0 32px;font-size:16px;line-height:1.6;color:#444">
          Para começar com o pé direito, explore o seu Dashboard e conheça nossos planos para liberar ainda mais recursos:
        </p>
        
        <div style="background:#faf9f8;border:1px solid #eaeaea;border-radius:16px;padding:24px;margin-bottom:32px;">
          <h3 style="margin:0 0 16px;font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px">Planos Disponíveis</h3>
          {cards}
        </div>

        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px">
          <tr>
            <td align="center">
              <a href="{dashboard_url}" style="display:inline-block;background:#C15F3C;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:16px 36px;border-radius:12px;box-shadow:0 4px 12px rgba(193,95,60,0.3)">Acessar meu Dashboard</a>
            </td>
          </tr>
        </table>
        
        <div style="text-align:center;margin-top:24px">
          <a href="{plans_url}" style="color:#C15F3C;font-size:15px;font-weight:600;text-decoration:none;">Ou compare os planos aqui &rarr;</a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background:#fcfcfc;padding:32px 40px;text-align:center;border-top:1px solid #eaeaea">
        <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#888;">
          Este e-mail foi enviado porque você (ou alguém usando este e-mail) criou uma conta na Laurena Studio. Se não foi você, por favor ignore.
        </p>
        <p style="margin:0;font-size:12px;color:#aaa;font-weight:500">© Laurena Studio. Todos os direitos reservados.</p>
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
