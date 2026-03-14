"""
services/laurena_code_service.py
LAURENA CODE — AI Agent orchestration service.

Multi-agent system that uses Gemini 2.5 for code generation, planning,
debugging, testing, and deployment.  Each agent has a specialised system
prompt and tool-set.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import subprocess
import sys
import uuid
from functools import partial
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

from app.core.config import settings
from app.schemas.laurena_code import (
    ActionType,
    AgentAction,
    AgentType,
    ChatMessage,
    ChatRole,
    ChatRequest,
    ChatResponse,
    CreateProjectRequest,
    CreateProjectResponse,
    FileNode,
    TerminalCommandResponse,
)
from app.services.ai_service import _get_client

logger = logging.getLogger(__name__)

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent / "workspaces"
WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)


# ── Agent system prompts ──────────────────────────────────────────────────────

AGENT_SYSTEM_PROMPTS: dict[AgentType, str] = {
    AgentType.PLANNER: (
        "Você é o Agente Planejador do LAURENA CODE. Sua função é:\n"
        "1. Analisar a tarefa do usuário\n"
        "2. Decompor em etapas claras e executáveis\n"
        "3. Identificar tecnologias e frameworks necessários\n"
        "4. Criar um plano de execução detalhado\n"
        "5. Estimar a complexidade de cada etapa\n\n"
        "Responda SEMPRE em português brasileiro.\n"
        "Retorne o plano como uma lista numerada de etapas.\n"
        "Para cada etapa, indique qual agente deve executar (coder, debugger, tester, devops)."
    ),
    AgentType.CODER: (
        "Você é o Agente Codificador do LAURENA CODE, um desenvolvedor IA de elite.\n"
        "Sua função é escrever código de alta qualidade seguindo as melhores práticas.\n\n"
        "Regras:\n"
        "- Escreva código limpo, bem estruturado e documentado\n"
        "- Use tipagem quando disponível (TypeScript, Python type hints)\n"
        "- Siga os padrões do projeto existente\n"
        "- Inclua tratamento de erros adequado\n"
        "- Quando criar arquivos, use o formato JSON de ações:\n"
        '  {"type": "create_file", "file": "caminho/arquivo.ext", "content": "conteúdo"}\n'
        '  {"type": "edit_file", "file": "caminho/arquivo.ext", "content": "novo conteúdo"}\n'
        '  {"type": "terminal", "command": "npm install pacote"}\n\n'
        "Responda SEMPRE em português brasileiro.\n"
        "Quando gerar código, envie-o dentro de blocos ```linguagem\\ncódigo```.\n"
        "Ao final, liste todas as ações necessárias em formato JSON."
    ),
    AgentType.DEBUGGER: (
        "Você é o Agente Depurador do LAURENA CODE.\n"
        "Sua função é analisar erros, identificar causas raiz e propor correções.\n\n"
        "Capacidades:\n"
        "- Analisar stack traces e logs de erro\n"
        "- Identificar bugs lógicos e de sintaxe\n"
        "- Propor patches corretivos com código\n"
        "- Explicar a causa do erro em linguagem simples\n\n"
        "Responda SEMPRE em português brasileiro.\n"
        "Para cada bug encontrado:\n"
        "1. Explique o problema\n"
        "2. Mostre a causa raiz\n"
        "3. Forneça o código corrigido"
    ),
    AgentType.TESTER: (
        "Você é o Agente de Testes do LAURENA CODE.\n"
        "Sua função é gerar e executar testes automatizados.\n\n"
        "Capacidades:\n"
        "- Gerar testes unitários (pytest, jest, vitest)\n"
        "- Gerar testes de integração\n"
        "- Gerar testes E2E (Playwright, Cypress)\n"
        "- Analisar cobertura de código\n"
        "- Identificar edge cases\n\n"
        "Responda SEMPRE em português brasileiro.\n"
        "Para cada arquivo de teste:\n"
        "1. Descreva o que está sendo testado\n"
        "2. Forneça o código de teste completo\n"
        "3. Indique como executar"
    ),
    AgentType.DEVOPS: (
        "Você é o Agente DevOps do LAURENA CODE.\n"
        "Sua função é gerenciar infraestrutura, CI/CD e deployment.\n\n"
        "Capacidades:\n"
        "- Criar Dockerfiles e docker-compose.yml\n"
        "- Configurar CI/CD (GitHub Actions, GitLab CI)\n"
        "- Gerenciar deployments (Vercel, Railway, AWS, Azure)\n"
        "- Configurar variáveis de ambiente\n"
        "- Gerenciar Kubernetes manifests\n\n"
        "Responda SEMPRE em português brasileiro."
    ),
    AgentType.ML: (
        "Você é o Agente de Machine Learning do LAURENA CODE.\n"
        "Sua função é auxiliar em projetos de IA e ciência de dados.\n\n"
        "Capacidades:\n"
        "- Criar modelos com PyTorch, TensorFlow, scikit-learn\n"
        "- Otimizar hiperparâmetros\n"
        "- Preparar e processar dados\n"
        "- Configurar treinamento distribuído\n"
        "- Integrar com MLFlow, Weights & Biases\n\n"
        "Responda SEMPRE em português brasileiro."
    ),
}


# ── Gemini text generation ────────────────────────────────────────────────────

GEMINI_MODEL = "gemini-2.5-flash-image"


def _agent_config(system_prompt: str) -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        temperature=1,
        top_p=0.95,
        max_output_tokens=32768,
        response_modalities=["TEXT"],
        safety_settings=[
            types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
        ],
        system_instruction=[types.Part.from_text(text=system_prompt)],
    )


def _sync_agent_chat(
    system_prompt: str,
    messages: list[dict[str, str]],
) -> str:
    client = _get_client()
    config = _agent_config(system_prompt)

    contents: list[types.Content] = []
    for msg in messages:
        role = "user" if msg["role"] in ("user", "system") else "model"
        contents.append(
            types.Content(
                role=role,
                parts=[types.Part.from_text(text=msg["content"])],
            )
        )

    text_parts: list[str] = []
    for chunk in client.models.generate_content_stream(
        model=GEMINI_MODEL,
        contents=contents,
        config=config,
    ):
        if not chunk.candidates:
            continue
        for part in chunk.candidates[0].content.parts:
            if part.text:
                text_parts.append(part.text)

    return "".join(text_parts)


# ── Agent Manager ─────────────────────────────────────────────────────────────

def _select_agent(message: str, requested_agents: list[AgentType]) -> AgentType:
    msg_lower = message.lower()
    if any(kw in msg_lower for kw in ["/plan", "planeje", "planejamento", "plano"]):
        return AgentType.PLANNER
    if any(kw in msg_lower for kw in ["/fix", "bug", "erro", "debug", "corrigir", "consertar"]):
        return AgentType.DEBUGGER
    if any(kw in msg_lower for kw in ["/test", "teste", "testar", "cobertura"]):
        return AgentType.TESTER
    if any(kw in msg_lower for kw in ["/deploy", "docker", "ci/cd", "kubernetes", "deploy"]):
        return AgentType.DEVOPS
    if any(kw in msg_lower for kw in ["/ml", "machine learning", "modelo", "treinamento", "pytorch", "tensorflow"]):
        return AgentType.ML
    if requested_agents:
        return requested_agents[0]
    return AgentType.CODER


def _parse_actions(ai_response: str) -> list[AgentAction]:
    actions: list[AgentAction] = []
    try:
        start = ai_response.find("[")
        end = ai_response.rfind("]")
        if start != -1 and end != -1 and end > start:
            json_str = ai_response[start:end + 1]
            raw_actions = json.loads(json_str)
            for act in raw_actions:
                if isinstance(act, dict) and "type" in act:
                    try:
                        actions.append(AgentAction(
                            type=ActionType(act["type"]),
                            file=act.get("file"),
                            content=act.get("content"),
                            command=act.get("command"),
                            description=act.get("description"),
                        ))
                    except (ValueError, KeyError):
                        pass
    except (json.JSONDecodeError, ValueError):
        pass
    return actions


# ── Public API ────────────────────────────────────────────────────────────────

async def chat_with_agent(request: ChatRequest) -> ChatResponse:
    agent = _select_agent(request.message, request.agents_enabled)
    system_prompt = AGENT_SYSTEM_PROMPTS[agent]

    context_parts: list[str] = []
    if request.project_path:
        context_parts.append(f"Projeto atual: {request.project_path}")
    if request.active_file:
        context_parts.append(f"Arquivo ativo: {request.active_file}")
    if request.selected_code:
        context_parts.append(f"Código selecionado:\n```\n{request.selected_code}\n```")

    messages: list[dict[str, str]] = []
    for msg in request.conversation_history[-10:]:
        messages.append({"role": msg.role.value, "content": msg.content})

    user_content = request.message
    if context_parts:
        user_content = "\n".join(context_parts) + "\n\n" + user_content
    messages.append({"role": "user", "content": user_content})

    loop = asyncio.get_running_loop()
    ai_text = await loop.run_in_executor(
        None, partial(_sync_agent_chat, system_prompt, messages),
    )

    actions = _parse_actions(ai_text)
    plan: list[str] | None = None
    if agent == AgentType.PLANNER:
        plan = [line.strip() for line in ai_text.split("\n") if line.strip() and line.strip()[0].isdigit()]

    return ChatResponse(
        message=ai_text, actions=actions, agent=agent,
        model_used=request.model_id, plan=plan,
    )


async def create_project(request: CreateProjectRequest) -> CreateProjectResponse:
    project_name = request.project_name or f"projeto-{uuid.uuid4().hex[:8]}"
    project_path = WORKSPACE_ROOT / project_name
    project_path.mkdir(parents=True, exist_ok=True)

    planner_prompt = (
        f"O usuário quer criar o seguinte projeto: {request.description}\n\n"
        "Crie um plano detalhado de execução com:\n"
        "1. Lista de arquivos a serem criados\n"
        "2. Estrutura de diretórios\n"
        "3. Dependências necessárias\n"
        "4. Comandos de inicialização\n\n"
        "Após o plano, gere TODOS os arquivos necessários no formato:\n"
        "```json\n"
        '[{"type": "create_file", "file": "caminho/arquivo", "content": "conteúdo completo"}]\n'
        "```"
    )

    loop = asyncio.get_running_loop()
    ai_text = await loop.run_in_executor(
        None,
        partial(_sync_agent_chat, AGENT_SYSTEM_PROMPTS[AgentType.CODER], [{"role": "user", "content": planner_prompt}]),
    )

    actions = _parse_actions(ai_text)
    files_created: list[str] = []
    for action in actions:
        if action.type == ActionType.CREATE_FILE and action.file and action.content:
            file_path = project_path / action.file
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(action.content, encoding="utf-8")
            files_created.append(action.file)
            logger.info("Created file: %s", file_path)

    return CreateProjectResponse(
        project_name=project_name, project_path=str(project_path),
        files_created=files_created, actions_executed=actions, summary=ai_text[:500],
    )


# ── File Operations ───────────────────────────────────────────────────────────

def _get_language(ext: str) -> str:
    mapping = {
        ".py": "python", ".js": "javascript", ".ts": "typescript",
        ".tsx": "typescriptreact", ".jsx": "javascriptreact",
        ".html": "html", ".css": "css", ".scss": "scss",
        ".json": "json", ".yaml": "yaml", ".yml": "yaml",
        ".md": "markdown", ".sql": "sql", ".sh": "shell",
        ".ps1": "powershell", ".bat": "bat", ".cmd": "bat",
        ".dockerfile": "dockerfile", ".go": "go", ".rs": "rust",
        ".java": "java", ".kt": "kotlin", ".swift": "swift",
        ".rb": "ruby", ".php": "php", ".c": "c", ".cpp": "cpp",
        ".h": "c", ".hpp": "cpp", ".cs": "csharp", ".dart": "dart",
        ".lua": "lua", ".r": "r", ".pl": "perl", ".scala": "scala",
        ".ex": "elixir", ".zig": "zig",
        ".vue": "vue", ".svelte": "svelte",
        ".toml": "toml", ".xml": "xml", ".env": "dotenv",
        ".ini": "ini", ".txt": "plaintext",
    }
    return mapping.get(ext.lower(), "plaintext")


def _normalize_path(p: Path, base: Path) -> str:
    """Return forward-slash relative path (consistent across OS)."""
    return str(p.relative_to(base)).replace("\\", "/")


def list_directory(path: str) -> list[FileNode]:
    base = Path(path)
    if not base.exists():
        return []

    def _scan(p: Path, depth: int = 0) -> list[FileNode]:
        if depth > 4:
            return []
        nodes: list[FileNode] = []
        try:
            entries = sorted(p.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
        except PermissionError:
            return []

        skip_dirs = {"node_modules", ".git", "__pycache__", ".venv", "venv", ".next", "dist", "build", ".idea", ".vscode"}
        for entry in entries:
            if entry.name.startswith(".") and entry.name not in (".env", ".gitignore", ".dockerignore", ".editorconfig"):
                continue
            if entry.is_dir() and entry.name in skip_dirs:
                continue

            rel_path = _normalize_path(entry, base)
            node = FileNode(
                name=entry.name,
                path=rel_path,
                is_dir=entry.is_dir(),
                extension=entry.suffix.lower() if entry.is_file() else None,
                size=entry.stat().st_size if entry.is_file() else None,
            )
            if entry.is_dir():
                node.children = _scan(entry, depth + 1)
            nodes.append(node)
        return nodes

    return _scan(base)


def read_file(base_path: str, file_path: str) -> tuple[str, str]:
    full = Path(base_path) / file_path
    if not full.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {file_path}")
    if full.stat().st_size > 5 * 1024 * 1024:
        raise ValueError("Arquivo muito grande (máximo 5 MB)")
    content = full.read_text(encoding="utf-8", errors="replace")
    lang = _get_language(full.suffix)
    return content, lang


def write_file(base_path: str, file_path: str, content: str) -> bool:
    full = Path(base_path) / file_path
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(content, encoding="utf-8")
    return True


def create_file(base_path: str, file_path: str, content: str = "") -> bool:
    full = Path(base_path) / file_path
    if full.exists():
        raise FileExistsError(f"Arquivo já existe: {file_path}")
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(content, encoding="utf-8")
    return True


def create_folder(base_path: str, folder_path: str) -> bool:
    full = Path(base_path) / folder_path
    full.mkdir(parents=True, exist_ok=True)
    return True


def delete_file(base_path: str, file_path: str) -> bool:
    full = Path(base_path) / file_path
    if not full.exists():
        raise FileNotFoundError(f"Não encontrado: {file_path}")
    if full.is_dir():
        shutil.rmtree(full)
    else:
        full.unlink()
    return True


def rename_file(base_path: str, old_path: str, new_path: str) -> bool:
    src = Path(base_path) / old_path
    dst = Path(base_path) / new_path
    if not src.exists():
        raise FileNotFoundError(f"Não encontrado: {old_path}")
    if dst.exists():
        raise FileExistsError(f"Já existe: {new_path}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    src.rename(dst)
    return True


def save_uploaded_file(base_path: str, file_path: str, data: bytes) -> bool:
    full = Path(base_path) / file_path
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_bytes(data)
    return True


# ── Terminal ──────────────────────────────────────────────────────────────────

DANGEROUS_PATTERNS = ["rm -rf /", "rm -rf /*", "format c:", "del /s /q c:", "mkfs", "dd if=", ":(){:|:&};:"]


def _resolve_terminal_cwd(project: str | None) -> str:
    """Resolve the working directory for terminal commands."""
    if project:
        p = WORKSPACE_ROOT / project
        p.mkdir(parents=True, exist_ok=True)
        return str(p)
    return str(WORKSPACE_ROOT)


async def execute_command(command: str, cwd: str | None = None) -> TerminalCommandResponse:
    cmd_lower = command.lower().strip()
    for dangerous in DANGEROUS_PATTERNS:
        if dangerous in cmd_lower:
            return TerminalCommandResponse(
                stdout="", stderr=f"⚠️ Comando bloqueado por segurança: {command}", exit_code=1,
            )

    work_dir = _resolve_terminal_cwd(cwd)
    logger.info("Terminal exec: cmd=%s, cwd=%s", command[:100], work_dir)

    try:
        if sys.platform == "win32":
            proc = await asyncio.create_subprocess_exec(
                "cmd", "/c", command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=work_dir,
            )
        else:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=work_dir,
            )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        return TerminalCommandResponse(
            stdout=stdout.decode("utf-8", errors="replace"),
            stderr=stderr.decode("utf-8", errors="replace"),
            exit_code=proc.returncode or 0,
        )
    except asyncio.TimeoutError:
        return TerminalCommandResponse(
            stdout="", stderr="⚠️ Comando excedeu o tempo limite de 60 segundos", exit_code=124,
        )
    except Exception as exc:
        logger.exception("Terminal error")
        return TerminalCommandResponse(
            stdout="", stderr=f"Erro ao executar comando: {exc}", exit_code=1,
        )
