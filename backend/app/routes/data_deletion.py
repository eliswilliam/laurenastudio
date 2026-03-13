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
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Request, Form, HTTPException, Depends, status
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User
from app.models.workspace import Workspace
from app.models.membership import Membership
from app.models.subscription import Subscription
from app.models.ai_generation import AIGeneration
from app.models.media import Media

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

_bearer = HTTPBearer(auto_error=False)


async def get_authenticated_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
):
    """
    Extrai e valida JWT. Retorna User autenticado.
    REQUER: Authorization: Bearer <token>
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token JWT requerido",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub", "")
        token_type: str = payload.get("type", "")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user_id or token_type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado",
        )

    return user


# ─── Utilitaire : Suppression complète d'un utilisateur ─────────────────────

async def _delete_all_user_data(user_id: str, db: AsyncSession) -> bool:
    """
    Supprime toutes les données liées à un utilisateur :
    - Media, AIGenerations
    - Workspaces (en cascade)
    - Memberships (en cascade)
    - Subscriptions
    - Utilisateur lui-même
    
    Returns: True si utilisateur trouvé et supprimé, False sinon.
    """
    # Vérify user exists
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    
    if not user:
        return False
    
    try:
        # Supprimer les données liées (en cascades SQLAlchemy)
        await db.execute(delete(Media).where(Media.workspace_id.in_(
            select(Workspace.id).where(Workspace.owner_id == user_id)
        )))
        
        await db.execute(delete(AIGeneration).where(AIGeneration.workspace_id.in_(
            select(Workspace.id).where(Workspace.owner_id == user_id)
        )))
        
        # Les cascades (Workspace → Membership, Subscription) s'appliquent automatiquement
        await db.execute(delete(Workspace).where(Workspace.owner_id == user_id))
        await db.execute(delete(Membership).where(Membership.user_id == user_id))
        await db.execute(delete(Subscription).where(Subscription.user_id == user_id))
        
        # Supprimer l'utilisateur
        await db.delete(user)
        await db.commit()
        
        return True
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting user data: {str(e)}"
        )


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
        await _delete_all_user_data(user.id, db)
    
    # Meta exige cette réponse
    return {
        "url": f"{settings.BACKEND_URL}/webhooks/deletion-status?id={facebook_id}",
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
        await _delete_all_user_data(user.id, db)
    
    return {"status": "deleted", "confirmation_code": google_id}


@router.get("/delete-my-data", response_class=HTMLResponse)
async def delete_my_data_page(
    current_user = Depends(get_authenticated_user),
):
    """
    Página de confirmação para exclusão de dados.
    REQUER: Authorization: Bearer <jwt_token>
    
    Fluxo:
    1. Usuário autenticado acessa a página
    2. Confirma exclusão
    3. POST para /request-deletion com JWT
    4. Dados são deletados
    5. Desconexão automática
    6. Redirecionamento para home
    """
    # Recuperar token do header (será passado via JavaScript)
    return """
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Excluir meus dados — Laurena Studio</title>
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
                <span class="spinner"></span><span id="providerText">Detectando...</span>
            </div>
            <p>Esta ação é <strong>irreversível</strong>. Todos os seus dados pessoais serão deletados permanentemente.</p>
            
            <div class="warning">
                ⚠️ <strong>Atenção:</strong> 
                <ul>
                    <li>Você será desconectado imediatamente</li>
                    <li>Todos os dados serão removidos em até 30 dias (LGPD)</li>
                    <li>Não é possível recuperar após a exclusão</li>
                </ul>
            </div>

            <form id="deleteForm">
                <div class="checkbox-group">
                    <input 
                        type="checkbox" 
                        id="confirm" 
                        name="confirm" 
                        required 
                    />
                    <label for="confirm">Confirmo que desejo deletar permanentemente minha conta e todos os dados associados</label>
                </div>

                <button type="submit" id="submitBtn">Deletar e desconectar</button>
                <div class="info">✓ Você será redirecionado após confirmação</div>
                <a href="/" class="link-back">← Voltar</a>
            </form>
        </div>

        <script>
            const token = localStorage.getItem('access_token');
            
            if (!token) {
                window.location.href = '/login';
            }
            
            // Detectar automaticamente o provider de login
            function detectProvider() {
                const user = localStorage.getItem('user');
                let provider = 'Plataforma';
                
                if (user) {
                    try {
                        const userObj = JSON.parse(user);
                        // Se tem google_id, foi via Google
                        // Se tem facebook_id, foi via Facebook
                        // Se tem apenas email/password, foi via Plataforma
                        if (userObj.provider === 'google' || userObj.google_id) {
                            provider = '🔤 Google';
                        } else if (userObj.provider === 'facebook' || userObj.facebook_id) {
                            provider = 'f Facebook';
                        } else {
                            provider = '🔐 Plataforma Laurena';
                        }
                    } catch (e) {
                        // Se erro no parse, assumir plataforma
                        provider = '🔐 Plataforma Laurena';
                    }
                }
                
                return provider;
            }
            
            // Atualizar badge com provider detectado
            const provider = detectProvider();
            document.getElementById('providerText').textContent = 'Conectado via: ' + provider;
            
            document.getElementById('deleteForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('submitBtn');
                btn.disabled = true;
                btn.textContent = '⏳ Processando exclusão...';

                try {
                    const res = await fetch('/api/v1/webhooks/request-deletion', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token,
                        },
                        body: JSON.stringify({}),
                    });

                    const data = await res.json();
                    
                    if (res.ok) {
                        // Clear local storage
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('refresh_token');
                        localStorage.removeItem('user');
                        
                        // Show success
                        document.body.innerHTML = `
                            <div class="container">
                                <h1 style="color: #2a9d4e;">✓ Exclusão solicitada</h1>
                                <p>Sua conta será deletada em até 30 dias conforme a LGPD.</p>
                                <p><strong>Código de confirmação:</strong><br/><code style="background: #f0e4dd; padding: 8px; border-radius: 4px; display: inline-block; margin-top: 8px; font-family: monospace;">${data.confirmation_code}</code></p>
                                <p style="font-size: 14px; color: #7a7168; margin-top: 20px;">
                                    Você será redirecionado em 3 segundos...
                                </p>
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
                    console.error(err);
                    alert('Erro de conexão: ' + err.message);
                    btn.disabled = false;
                    btn.textContent = 'Deletar e desconectar';
                }
            });
        </script>
    </body>
    </html>
    """


@router.post("/request-deletion")
async def request_deletion(
    current_user = Depends(get_authenticated_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint para deletar dados do usuário autenticado.
    REQUER: Authorization: Bearer <jwt_token>
    
    1. Extrai user_id do JWT
    2. Deleta todos os dados
    3. Retorna confirmation_code
    
    O frontend então deve:
    - Remover tokens do localStorage
    - Redirecionar para /
    """
    user_id = current_user.id
    social_id = current_user.google_id or current_user.facebook_id or user_id
    
    # Delete all user data
    success = await _delete_all_user_data(user_id, db)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    
    return {
        "confirmation_code": social_id,
        "status": "deleted",
        "message": "Seus dados foram marcados para exclusão. Você será removido em até 30 dias.",
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
