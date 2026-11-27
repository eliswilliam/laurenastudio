"""
routes/data_deletion.py
Rotas para exclusão de dados do usuário — Conformidade LGPD/Meta/Google.

FLUXO:
1. GET  /webhooks/delete-my-data       ← PROTEGIDA (JWT) - Página para usuário conectado
2. POST /webhooks/request-deletion     ← PROTEGIDA (JWT) - Delete + Logout automático
3. GET  /webhooks/deletion-status      ← PÚBLICA (Meta verifica aqui)
4. POST /webhooks/delete-meta          ← Meta callback (signed_request)
5. POST /webhooks/delete-google        ← Google callback (ID token)
"""
import hmac
import hashlib
import base64
import json
import logging
from urllib.parse import urlparse
from datetime import datetime, timezone

from fastapi import APIRouter, Request, Form, HTTPException, Depends, Response, status
from fastapi.responses import HTMLResponse
from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)
from app.db.session import get_db
from app.models.user import User
from app.models.workspace import Workspace
from app.models.membership import Membership
from app.models.subscription import Subscription
from app.models.usage_tracking import UsageTracking
from app.models.ai_generation import AIGeneration
from app.models.media import Media
from app.models.password_reset import PasswordReset
from app.models.site_project import SiteProject, SitePrompt, GeneratedSite, SiteDeployment, SiteGitSnapshot
from app.models.background_job import BackgroundJob
from app.models.user_notification import UserNotification
from app.routes.auth import get_current_user
from app.services.job_service import create_job
from app.workers.delete_published_site_task import arq_delete_published_site

try:
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
except ImportError:
    id_token = None
    google_requests = None

router = APIRouter(prefix="/webhooks", tags=["data-deletion"])

# Config from .env
META_APP_SECRET = settings.FACEBOOK_APP_SECRET if hasattr(settings, "FACEBOOK_APP_SECRET") else ""
GOOGLE_CLIENT_ID = settings.GOOGLE_CLIENT_ID if hasattr(settings, "GOOGLE_CLIENT_ID") else ""


# ─── Utilitaire : Suppression complète d'un utilisateur ─────────────────────

async def _delete_all_user_data(user_id: str, db: AsyncSession) -> bool:
    """
    Supprime toutes les données liées à un utilisateur — conforme LGPD.

    Ordre de suppression (contraintes FK respectées, pas de cascade implicite) :
    1. Notifications utilisateur
    2. Réinitialisations de mot de passe
    3. Données site-builder (git snapshots → deployments → generated site → prompts → projects)
    4. Background jobs (user_id direct)
    5. Médias + générations IA (liés aux workspaces)
    6. Suivi d'utilisation
    7. Subscriptions
    8. Workspaces (cascade ORM → memberships liées au workspace)
    9. Memberships résiduels (l'user peut être membre d'autres workspaces)
    10. Utilisateur lui-même

    Returns True si l'utilisateur existait et a été supprimé.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        return False

    try:
        # ── workspace sub-query (réutilisé plusieurs fois) ────────────────
        owned_workspaces = select(Workspace.id).where(Workspace.owner_id == user_id)

        # 1. Notifications
        await db.execute(
            delete(UserNotification).where(UserNotification.user_id == user_id)
        )

        # 2. Password resets
        await db.execute(
            delete(PasswordReset).where(PasswordReset.user_id == user_id)
        )

        # 3a. Git snapshots (FK → site_projects)
        site_projects_q = select(SiteProject.id).where(SiteProject.user_id == user_id)
        await db.execute(
            delete(SiteGitSnapshot).where(SiteGitSnapshot.project_id.in_(site_projects_q))
        )
        # 3b. Deployments
        await db.execute(
            delete(SiteDeployment).where(SiteDeployment.project_id.in_(site_projects_q))
        )
        # 3c. Generated sites
        await db.execute(
            delete(GeneratedSite).where(GeneratedSite.project_id.in_(site_projects_q))
        )
        # 3d. Site prompts
        await db.execute(
            delete(SitePrompt).where(SitePrompt.project_id.in_(site_projects_q))
        )
        # 3e. Site projects themselves
        await db.execute(
            delete(SiteProject).where(SiteProject.user_id == user_id)
        )

        # 4. Background jobs (direct user_id column)
        await db.execute(
            delete(BackgroundJob).where(BackgroundJob.user_id == user_id)
        )

        # 5. Media + AI generations (workspace-scoped)
        await db.execute(
            delete(Media).where(Media.workspace_id.in_(owned_workspaces))
        )
        await db.execute(
            delete(AIGeneration).where(AIGeneration.workspace_id.in_(owned_workspaces))
        )

        # 6. Usage tracking
        await db.execute(
            delete(UsageTracking).where(UsageTracking.workspace_id.in_(owned_workspaces))
        )

        # 7. Subscriptions
        await db.execute(
            delete(Subscription).where(Subscription.workspace_id.in_(owned_workspaces))
        )

        # 8. Workspaces (ORM cascade deletes linked memberships owned by the workspace)
        await db.execute(delete(Workspace).where(Workspace.owner_id == user_id))

        # 9. Memberships where user is a member of OTHER workspaces
        await db.execute(delete(Membership).where(Membership.user_id == user_id))

        # 10. User record
        await db.delete(user)
        await db.commit()
        return True

    except Exception as e:
        await db.rollback()
        # SECURITY: never expose DB exception details to the client (schema/table leakage).
        logger.exception("Data deletion failed for request: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting user data. Please try again.",
        )


def _service_name_from_repo_url(repo_url: str | None) -> str | None:
    raw = (repo_url or "").strip()
    if not raw:
        return None
    try:
        path = urlparse(raw).path or ""
    except Exception:
        return None
    parts = [p for p in path.strip("/").split("/") if p]
    if len(parts) < 2:
        return None
    repo = parts[-1]
    if repo.endswith(".git"):
        repo = repo[:-4]
    return repo or None


async def _delete_all_published_sites_for_user(user: User, db: AsyncSession) -> dict:
    """
    Collect all published-site targets visible in /sites-publicados for the user,
    create one delete job per target, and execute the same delete worker flow.
    """
    deployment_result = await db.execute(
        select(SiteDeployment, SiteProject)
        .join(SiteProject, SiteProject.id == SiteDeployment.project_id)
        .where(SiteProject.user_id == user.id)
        .order_by(desc(SiteDeployment.created_at))
    )
    deployment_rows = deployment_result.all()

    payloads: list[dict] = []
    seen_targets: set[tuple[str | None, str | None, str | None, str | None, str | None]] = set()

    for deployment, project in deployment_rows:
        is_active = deployment.status in ("pending", "processing")
        has_info = any(
            [
                deployment.site_url,
                deployment.github_repo_url,
                deployment.cloud_run_url,
                deployment.slug,
            ]
        )
        if not is_active and not has_info:
            continue

        slug = (deployment.slug or project.publish_slug or "").strip().lower() or None
        repo_url = (deployment.github_repo_url or "").strip() or None
        service_name = (deployment.cloud_run_service_name or "").strip() or None
        cloud_run_url = (deployment.cloud_run_url or "").strip() or None
        site_url = (deployment.site_url or "").strip() or None

        dedupe_key = (slug, repo_url, service_name, cloud_run_url, site_url)
        if dedupe_key in seen_targets:
            continue
        seen_targets.add(dedupe_key)

        payloads.append(
            {
                "user_id": user.id,
                "project_id": project.id,
                "deployment_id": deployment.id,
                "slug": slug,
                "github_repo_url": repo_url,
                "cloud_run_service_name": service_name,
                "cloud_run_url": cloud_run_url,
                "site_url": site_url,
            }
        )

    legacy_jobs_result = await db.execute(
        select(BackgroundJob)
        .where(BackgroundJob.job_type == "publish_site")
        .where(BackgroundJob.status == "success")
        .where(BackgroundJob.project_id.is_(None))
        .where(BackgroundJob.user_id == user.id)
        .order_by(desc(BackgroundJob.created_at))
    )
    legacy_jobs = legacy_jobs_result.scalars().all()

    for job in legacy_jobs:
        input_payload = job.input_payload or {}
        result_payload = job.result or {}

        slug = (input_payload.get("slug") or "").strip().lower() or None
        repo_url = (result_payload.get("github") or "").strip() or None
        service_name = (
            (result_payload.get("cloudRunServiceName") or "").strip()
            or _service_name_from_repo_url(repo_url)
        )
        cloud_run_url = (result_payload.get("cloudRun") or "").strip() or None
        site_url = (result_payload.get("siteUrl") or "").strip() or None

        if not site_url and not repo_url and not cloud_run_url:
            continue

        dedupe_key = (slug, repo_url, service_name, cloud_run_url, site_url)
        if dedupe_key in seen_targets:
            continue
        seen_targets.add(dedupe_key)

        payloads.append(
            {
                "user_id": user.id,
                "project_id": None,
                "deployment_id": None,
                "slug": slug,
                "github_repo_url": repo_url,
                "cloud_run_service_name": service_name,
                "cloud_run_url": cloud_run_url,
                "site_url": site_url,
            }
        )

    executed_jobs: list[str] = []
    failed_jobs: list[dict] = []

    for payload in payloads:
        delete_job = await create_job(
            db,
            job_type="delete_published_site",
            user_id=user.id,
            project_id=payload.get("project_id"),
            input_payload=payload,
        )
        await db.commit()

        job_id = str(delete_job.id)
        try:
            # Run the same worker used by /sites-publicados deletion.
            await arq_delete_published_site({}, job_id)
            executed_jobs.append(job_id)
        except Exception as exc:
            failed_jobs.append({"job_id": job_id, "error": str(exc)[:500]})

    return {
        "targets_found": len(payloads),
        "jobs_executed": len(executed_jobs),
        "jobs_failed": len(failed_jobs),
        "failed_jobs": failed_jobs,
    }


# ─── Meta / Facebook Callback ─────────────────────────────────────────────────

def _verify_meta_signature(signed_request: str) -> dict:
    """Vérifie la signature de la requête Meta avec app secret."""
    try:
        encoded_sig, payload = signed_request.split(".", 1)
        sig = base64.urlsafe_b64decode(encoded_sig + "==")
        expected = hmac.new(
            META_APP_SECRET.encode(),
            payload.encode(),
            hashlib.sha256,
        ).digest()
        
        if not hmac.compare_digest(sig, expected):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Meta signature"
            )
        
        decoded = base64.urlsafe_b64decode(payload + "==").decode("utf-8")
        return json.loads(decoded)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed signed_request"
        )


@router.post("/delete-meta")
async def delete_meta_user(
    signed_request: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """Webhook Meta pour suppression de données utilisateur."""
    data = _verify_meta_signature(signed_request)
    facebook_id = data.get("user_id")
    
    if not facebook_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing user_id in signed_request"
        )
    
    # Trouver utilisateur par facebook_id
    result = await db.execute(
        select(User).where(User.facebook_id == facebook_id)
    )
    user = result.scalars().first()
    
    if user:
        await _delete_all_published_sites_for_user(user, db)
        await _delete_all_user_data(user.id, db)
    
    # Meta exige cette réponse
    return {
        "url": f"{settings.BACKEND_URL}/api/v1/webhooks/deletion-status?id={facebook_id}",
        "confirmation_code": facebook_id,
    }


# ─── Google Callback ──────────────────────────────────────────────────────────

@router.post("/delete-google")
async def delete_google_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Webhook Google pour suppression de données utilisateur."""
    if not id_token or not google_requests:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google auth library not available"
        )
    
    try:
        body = await request.json()
        token = body.get("credential")
        
        if not token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing credential"
            )
        
        # Vérifier le token Google
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        google_id = idinfo["sub"]
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )
    
    # Trouver utilisateur par google_id
    result = await db.execute(
        select(User).where(User.google_id == google_id)
    )
    user = result.scalars().first()
    
    if user:
        await _delete_all_published_sites_for_user(user, db)
        await _delete_all_user_data(user.id, db)
    
    return {"status": "deleted", "confirmation_code": google_id}


@router.get("/delete-my-data", response_class=HTMLResponse)
async def delete_my_data_page(
    current_user=Depends(get_current_user),
):
    """
    Página de confirmação para exclusão de dados.
    REQUER: sessão autenticada (cookie HttpOnly ou Authorization header).
    
    Fluxo:
    1. Usuário autenticado acessa a página
    2. Confirma exclusão
    3. POST para /request-deletion com JWT
    4. Dados são deletados
    5. Desconexão automática
    6. Redirecionamento para home
    """
    provider = "Laurena"
    if getattr(current_user, "google_id", None):
        provider = "Google"
    elif getattr(current_user, "facebook_id", None):
        provider = "Facebook"

    html_content = """
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Excluir meus dados - Laurena Studio</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Inter', system-ui, sans-serif;
                background: linear-gradient(135deg, #f0e4dd 0%, #F4F3EE 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .container {
                width: 100%;
                max-width: 500px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                padding: 40px;
            }
            h1 { color: #C15F3C; margin-bottom: 16px; font-size: 24px; }
            p { color: #7a7168; margin-bottom: 16px; line-height: 1.6; }
            .provider-badge {
                display: inline-block;
                background: #f0e4dd;
                border: 1px solid #C15F3C;
                color: #9a3f20;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
                margin-bottom: 16px;
            }
            .warning {
                background: #fff3e0;
                border-left: 4px solid #C15F3C;
                padding: 16px;
                margin-bottom: 24px;
                border-radius: 4px;
                color: #9a3f20;
                font-size: 14px;
            }
            .warning ul { margin-left: 20px; margin-top: 8px; }
            .warning li { margin-bottom: 6px; }
            .checkbox-group {
                display: flex;
                align-items: flex-start;
                margin-bottom: 24px;
            }
            input[type="checkbox"] {
                margin-right: 12px;
                margin-top: 4px;
                cursor: pointer;
            }
            label {
                color: #2a1a10;
                font-weight: 500;
                cursor: pointer;
                margin: 0;
            }
            button {
                width: 100%;
                background: #C15F3C;
                color: white;
                padding: 12px;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.3s;
            }
            button:hover:not(:disabled) { background: #9a3f20; }
            button:disabled { background: #B1ADA1; cursor: not-allowed; }
            .info { font-size: 12px; color: #B1ADA1; margin-top: 12px; }
            .link-back {
                display: inline-block;
                margin-top: 20px;
                color: #C15F3C;
                text-decoration: none;
                font-weight: 500;
            }
            .link-back:hover { text-decoration: underline; }
            .spinner {
                display: inline-block;
                width: 14px;
                height: 14px;
                border: 3px solid #C15F3C;
                border-radius: 50%;
                border-top-color: transparent;
                animation: spin 0.8s linear infinite;
                margin-right: 8px;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Excluir meus dados</h1>
            <div class="provider-badge" id="providerBadge">
                <span class="spinner"></span><span id="providerText">Detectando provedor...</span>
            </div>
            <p>Esta acao e <strong>irreversivel</strong>. Todos os seus dados pessoais serao deletados permanentemente.</p>

            <div class="warning">
                <strong>Atencao:</strong>
                <ul>
                    <li>Voce sera desconectado imediatamente</li>
                    <li>Todos os dados serao removidos em ate 30 dias (LGPD)</li>
                    <li>Nao e possivel recuperar apos a exclusao</li>
                </ul>
            </div>

            <form id="deleteForm">
                <div class="checkbox-group">
                    <input type="checkbox" id="confirm" name="confirm" required />
                    <label for="confirm">Confirmo que desejo deletar permanentemente minha conta e todos os dados associados</label>
                </div>

                <button type="submit" id="submitBtn">Deletar e desconectar</button>
                <div class="info">Voce sera redirecionado apos confirmacao</div>
                <a href="/" class="link-back">Voltar</a>
            </form>
        </div>

        <script>
            const PROVIDER_SERVER = "___EMBEDDED_PROVIDER___";

            function detectProvider() {
                const user = localStorage.getItem('user');
                let provider = 'Laurena';

                if (user) {
                    try {
                        const userObj = JSON.parse(user);
                        if (userObj.provider === 'google' || userObj.google_id) {
                            provider = 'Google';
                        } else if (userObj.provider === 'facebook' || userObj.facebook_id) {
                            provider = 'Facebook';
                        }
                    } catch (e) {}
                }

                return provider;
            }

            const provider = PROVIDER_SERVER || detectProvider();
            document.getElementById('providerText').textContent = 'Conectado via: ' + provider;

            document.getElementById('deleteForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('submitBtn');
                btn.disabled = true;
                btn.textContent = 'Processando exclusao...';

                try {
                    const res = await fetch('/api/v1/webhooks/request-deletion', {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({}),
                    });

                    const data = await res.json();

                    if (res.ok) {
                        ['auth_token', 'access_token', 'refresh_token', 'user'].forEach((key) => {
                            localStorage.removeItem(key);
                            sessionStorage.removeItem(key);
                        });

                        document.body.innerHTML = `
                            <div class="container">
                                <h1 style="color: #2a9d4e;">Exclusao solicitada</h1>
                                <p>Sua conta sera deletada em ate 30 dias conforme a LGPD.</p>
                                <p><strong>Codigo de confirmacao:</strong><br/><code style="background: #f0e4dd; padding: 8px; border-radius: 4px; display: inline-block; margin-top: 8px; font-family: monospace;">${data.confirmation_code}</code></p>
                                <p style="font-size: 14px; color: #7a7168; margin-top: 20px;">Voce sera redirecionado em 3 segundos...</p>
                            </div>
                        `;

                        setTimeout(() => {
                            window.location.href = '/';
                        }, 3000);
                    } else {
                        alert('Erro: ' + (data.detail || 'Erro ao processar'));
                        btn.disabled = false;
                        btn.textContent = 'Deletar e desconectar';
                    }
                } catch (err) {
                    alert('Erro de conexao: ' + err.message);
                    btn.disabled = false;
                    btn.textContent = 'Deletar e desconectar';
                }
            });
        </script>
    </body>
    </html>
    """

    html_content = html_content.replace("___EMBEDDED_PROVIDER___", provider)
    return html_content


@router.post("/request-deletion")
async def request_deletion(
    response: Response,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint para deletar dados do usuário autenticado.
    REQUER: sessão autenticada (cookie HttpOnly ou Authorization header).
    
    1. Extrai user_id do JWT
    2. Deleta todos os dados
    3. Retorna confirmation_code
    
    O frontend então deve:
    - Remover tokens do localStorage
    - Redirecionar para /
    """
    user_id = current_user.id
    social_id = current_user.google_id or current_user.facebook_id or user_id

    site_cleanup_report = await _delete_all_published_sites_for_user(current_user, db)
    
    # Delete all user data
    success = await _delete_all_user_data(user_id, db)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )

    secure = request.url.scheme == "https" or settings.FRONTEND_URL.startswith("https://") or settings.BACKEND_URL.startswith("https://")
    response.delete_cookie(
        key=settings.AUTH_ACCESS_COOKIE_NAME,
        path="/",
        secure=secure,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key=settings.AUTH_REFRESH_COOKIE_NAME,
        path="/",
        secure=secure,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    
    return {
        "confirmation_code": social_id,
        "status": "deleted",
        "message": "Seus dados foram marcados para exclusão. Você será removido em até 30 dias.",
        "published_sites_cleanup": site_cleanup_report,
        "deleted_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/request-deletion-public")
async def request_deletion_public(
    db: AsyncSession = Depends(get_db),
    email: str = Form(None),
):
    """
    Endpoint público para solicitar exclusão de dados via email.
    PARA: Usuários não autenticados que desejam deletar sua conta via email.
    
    Fluxo:
    1. Usuário fornece email
    2. Endpoint procura usuário por email
    3. Se encontrado, marca para exclusão
    4. Retorna confirmation_code que será enviado por email
    """
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email é requerido"
        )
    
    # Procurar usuário por email
    result = await db.execute(
        select(User).where(User.email == email.lower())
    )
    user = result.scalars().first()
    
    if not user:
        # Por segurança, não revelamos se o email existe ou não
        # Mas retornamos sucesso mesmo assim
        return {
            "confirmation_code": "pending",
            "status": "pending",
            "message": "Se o email for válido, receberá instruções de exclusão em até 24 horas.",
        }
    
    site_cleanup_report = await _delete_all_published_sites_for_user(user, db)

    # Delete all user data
    success = await _delete_all_user_data(user.id, db)
    
    if not success:
        # Não deveria acontecer, mas trata o erro
        return {
            "confirmation_code": "error",
            "status": "error",
            "message": "Erro ao processar solicitação. Tente novamente.",
        }
    
    return {
        "confirmation_code": user.email,
        "status": "deleted",
        "message": "Sua conta será deletada em até 30 dias conforme a LGPD.",
        "published_sites_cleanup": site_cleanup_report,
        "deleted_at": datetime.now(timezone.utc).isoformat(),
    }


# ─── Statut de suppression ────────────────────────────────────────────────────

@router.get("/deletion-status")
async def deletion_status(
    id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Retourne le statut de suppression (pour Meta/Google/utilisateur).
    - deleted: utilisateur n'existe plus en base
    - pending: suppression en cours
    """
    # Chercher dans tous les champs d'ID social
    result = await db.execute(
        select(User).where(
            (User.google_id == id) | (User.facebook_id == id)
        )
    )
    user = result.scalars().first()
    
    status = "pending" if user else "deleted"
    
    return {
        "confirmation_code": id,
        "status": status,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
