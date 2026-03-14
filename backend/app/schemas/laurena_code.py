"""
schemas/laurena_code.py
Pydantic schemas for the LAURENA CODE AI IDE.
"""
from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ── AI Models ─────────────────────────────────────────────────────────────────

class AIModelProvider(str, Enum):
    GEMINI = "gemini"
    GPT = "gpt"
    CLAUDE = "claude"
    LLAMA = "llama"
    MISTRAL = "mistral"
    DEEPSEEK = "deepseek"
    CODESTRAL = "codestral"


class AIModelOption(BaseModel):
    id: str
    name: str
    provider: AIModelProvider
    description: str
    available: bool = False


# ── Agents ────────────────────────────────────────────────────────────────────

class AgentType(str, Enum):
    PLANNER = "planner"
    CODER = "coder"
    DEBUGGER = "debugger"
    TESTER = "tester"
    DEVOPS = "devops"
    ML = "ml"


class AgentStatus(str, Enum):
    IDLE = "idle"
    THINKING = "thinking"
    EXECUTING = "executing"
    DONE = "done"
    ERROR = "error"


# ── Actions ───────────────────────────────────────────────────────────────────

class ActionType(str, Enum):
    CREATE_FILE = "create_file"
    EDIT_FILE = "edit_file"
    DELETE_FILE = "delete_file"
    READ_FILE = "read_file"
    LIST_DIR = "list_dir"
    TERMINAL = "terminal"
    GIT = "git"
    TEST = "test"
    DEPLOY = "deploy"
    INSTALL = "install"


class AgentAction(BaseModel):
    type: ActionType
    file: str | None = None
    content: str | None = None
    command: str | None = None
    description: str | None = None


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    AGENT = "agent"


class ChatMessage(BaseModel):
    role: ChatRole
    content: str
    agent: AgentType | None = None
    actions: list[AgentAction] | None = None
    model_used: str | None = None


class ChatRequest(BaseModel):
    message: str
    model_id: str = "gemini-2.5-flash"
    project_path: str | None = None
    active_file: str | None = None
    selected_code: str | None = None
    conversation_history: list[ChatMessage] = Field(default_factory=list)
    agents_enabled: list[AgentType] = Field(default_factory=lambda: [AgentType.CODER])


class ChatResponse(BaseModel):
    message: str
    actions: list[AgentAction] = Field(default_factory=list)
    agent: AgentType | None = None
    model_used: str | None = None
    plan: list[str] | None = None


# ── Project ───────────────────────────────────────────────────────────────────

class ProjectTemplate(str, Enum):
    REACT = "react"
    NEXTJS = "nextjs"
    VUE = "vue"
    ANGULAR = "angular"
    FASTAPI = "fastapi"
    DJANGO = "django"
    EXPRESS = "express"
    NESTJS = "nestjs"
    FLUTTER = "flutter"
    REACT_NATIVE = "react_native"
    PYTORCH = "pytorch"
    CUSTOM = "custom"


class CreateProjectRequest(BaseModel):
    description: str
    template: ProjectTemplate | None = None
    model_id: str = "gemini-2.5-flash"
    project_name: str | None = None


class CreateProjectResponse(BaseModel):
    project_name: str
    project_path: str
    files_created: list[str]
    actions_executed: list[AgentAction]
    summary: str


# ── File Operations ───────────────────────────────────────────────────────────

class FileNode(BaseModel):
    name: str
    path: str
    is_dir: bool
    children: list[FileNode] | None = None
    size: int | None = None
    extension: str | None = None


class ReadFileRequest(BaseModel):
    path: str


class ReadFileResponse(BaseModel):
    path: str
    content: str
    language: str | None = None


class WriteFileRequest(BaseModel):
    path: str
    content: str


class WriteFileResponse(BaseModel):
    path: str
    success: bool


class CreateFileRequest(BaseModel):
    path: str
    content: str = ""
    language: str | None = None


class CreateFolderRequest(BaseModel):
    path: str


class DeleteFileRequest(BaseModel):
    path: str


class RenameFileRequest(BaseModel):
    old_path: str
    new_path: str


# ── Terminal ──────────────────────────────────────────────────────────────────

class TerminalCommandRequest(BaseModel):
    command: str
    cwd: str | None = None


class TerminalCommandResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int


# ── Available Models ──────────────────────────────────────────────────────────

AVAILABLE_MODELS: list[AIModelOption] = [
    AIModelOption(
        id="gemini-2.5-flash",
        name="Gemini 2.5 Flash",
        provider=AIModelProvider.GEMINI,
        description="Modelo rápido do Google com capacidade multimodal",
        available=True,
    ),
    AIModelOption(
        id="gemini-2.5-pro",
        name="Gemini 2.5 Pro",
        provider=AIModelProvider.GEMINI,
        description="Modelo avançado do Google para tarefas complexas",
        available=False,
    ),
    AIModelOption(
        id="gpt-4o",
        name="GPT-4o",
        provider=AIModelProvider.GPT,
        description="Modelo multimodal da OpenAI",
        available=False,
    ),
    AIModelOption(
        id="gpt-4o-mini",
        name="GPT-4o Mini",
        provider=AIModelProvider.GPT,
        description="Modelo rápido e econômico da OpenAI",
        available=False,
    ),
    AIModelOption(
        id="claude-4-opus",
        name="Claude 4 Opus",
        provider=AIModelProvider.CLAUDE,
        description="Modelo mais capaz da Anthropic",
        available=False,
    ),
    AIModelOption(
        id="claude-4-sonnet",
        name="Claude 4 Sonnet",
        provider=AIModelProvider.CLAUDE,
        description="Modelo equilibrado da Anthropic",
        available=False,
    ),
    AIModelOption(
        id="llama-3.3-70b",
        name="Llama 3.3 70B",
        provider=AIModelProvider.LLAMA,
        description="Modelo open source da Meta",
        available=False,
    ),
    AIModelOption(
        id="deepseek-v3",
        name="DeepSeek V3",
        provider=AIModelProvider.DEEPSEEK,
        description="Modelo de código avançado da DeepSeek",
        available=False,
    ),
    AIModelOption(
        id="codestral-latest",
        name="Codestral",
        provider=AIModelProvider.CODESTRAL,
        description="Modelo especializado em código da Mistral",
        available=False,
    ),
    AIModelOption(
        id="mistral-large",
        name="Mistral Large",
        provider=AIModelProvider.MISTRAL,
        description="Modelo flagship da Mistral AI",
        available=False,
    ),
]
