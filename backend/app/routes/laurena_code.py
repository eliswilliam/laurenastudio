"""
routes/laurena_code.py
API routes for the LAURENA CODE AI IDE.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query

from app.schemas.laurena_code import (
    AVAILABLE_MODELS,
    AIModelOption,
    ChatRequest,
    ChatResponse,
    CreateFileRequest,
    CreateFolderRequest,
    CreateProjectRequest,
    CreateProjectResponse,
    DeleteFileRequest,
    FileNode,
    ReadFileRequest,
    ReadFileResponse,
    RenameFileRequest,
    TerminalCommandRequest,
    TerminalCommandResponse,
    WriteFileRequest,
    WriteFileResponse,
)
from app.services.laurena_code_service import (
    WORKSPACE_ROOT,
    chat_with_agent,
    create_file,
    create_folder,
    create_project,
    delete_file,
    execute_command,
    list_directory,
    read_file,
    rename_file,
    save_uploaded_file,
    write_file,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/laurena-code", tags=["LAURENA CODE"])


def _resolve_base(project: str | None) -> str:
    """Resolve the base path for file operations."""
    if project:
        p = WORKSPACE_ROOT / project
        p.mkdir(parents=True, exist_ok=True)
        return str(p)
    return str(WORKSPACE_ROOT)


# ── Models ────────────────────────────────────────────────────────────────────

@router.get("/models", response_model=list[AIModelOption])
async def get_available_models():
    """List all available AI models for the IDE."""
    return AVAILABLE_MODELS


# ── Chat / Agent ──────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message to the AI agent and receive a response with actions."""
    try:
        return await chat_with_agent(request)
    except Exception as exc:
        logger.exception("Agent chat error")
        raise HTTPException(status_code=500, detail=str(exc))


# ── Project Creation ──────────────────────────────────────────────────────────

@router.post("/projects", response_model=CreateProjectResponse)
async def create_new_project(request: CreateProjectRequest):
    """Create a new project from a natural language description."""
    try:
        return await create_project(request)
    except Exception as exc:
        logger.exception("Project creation error")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/projects")
async def list_projects():
    """List all projects in the workspace."""
    projects = []
    if WORKSPACE_ROOT.exists():
        for entry in sorted(WORKSPACE_ROOT.iterdir()):
            if entry.is_dir() and not entry.name.startswith("."):
                projects.append({
                    "name": entry.name,
                    "path": str(entry),
                    "files_count": sum(1 for _ in entry.rglob("*") if _.is_file()),
                })
    return projects


# ── File Operations ───────────────────────────────────────────────────────────

@router.get("/files", response_model=list[FileNode])
async def list_files(project: str | None = None):
    """List files for a project (or workspace root)."""
    base = _resolve_base(project)
    try:
        return list_directory(base)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/files/read", response_model=ReadFileResponse)
async def read_project_file(req: ReadFileRequest, project: str | None = None):
    """Read the contents of a file."""
    base = _resolve_base(project)
    try:
        content, language = read_file(base, req.path)
        return ReadFileResponse(path=req.path, content=content, language=language)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Arquivo não encontrado: {req.path}")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/files/write", response_model=WriteFileResponse)
async def write_project_file(req: WriteFileRequest, project: str | None = None):
    """Write content to a file (create or overwrite)."""
    base = _resolve_base(project)
    try:
        ok = write_file(base, req.path, req.content)
        return WriteFileResponse(path=req.path, success=ok)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/files/create")
async def create_new_file(req: CreateFileRequest, project: str | None = None):
    """Create a new empty file."""
    base = _resolve_base(project)
    try:
        create_file(base, req.path, req.content)
        return {"path": req.path, "success": True}
    except FileExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/files/create-folder")
async def create_new_folder(req: CreateFolderRequest, project: str | None = None):
    """Create a new folder."""
    base = _resolve_base(project)
    try:
        create_folder(base, req.path)
        return {"path": req.path, "success": True}
    except FileExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/files/delete")
async def delete_project_file(req: DeleteFileRequest, project: str | None = None):
    """Delete a file or folder."""
    base = _resolve_base(project)
    try:
        delete_file(base, req.path)
        return {"path": req.path, "success": True}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Não encontrado: {req.path}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/files/rename")
async def rename_project_file(req: RenameFileRequest, project: str | None = None):
    """Rename or move a file or folder."""
    base = _resolve_base(project)
    try:
        rename_file(base, req.old_path, req.new_path)
        return {"old_path": req.old_path, "new_path": req.new_path, "success": True}
    except (FileNotFoundError, FileExistsError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    path: str = Form(""),
    project: str | None = Form(None),
):
    """Upload a file to the workspace."""
    base = _resolve_base(project)
    file_path = f"{path}/{file.filename}" if path else file.filename
    try:
        data = await file.read()
        save_uploaded_file(base, file_path, data)
        return {"path": file_path, "size": len(data), "success": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Terminal ──────────────────────────────────────────────────────────────────

@router.post("/terminal", response_model=TerminalCommandResponse)
async def run_terminal_command(req: TerminalCommandRequest):
    """Execute a terminal command in the workspace.
    cwd can be a project name or a full path.
    """
    return await execute_command(req.command, req.cwd)


@router.get("/health")
async def laurena_code_health():
    """Health check for LAURENA CODE services."""
    return {
        "status": "ok",
        "workspace": str(WORKSPACE_ROOT),
        "workspace_exists": WORKSPACE_ROOT.exists(),
        "projects_count": sum(1 for p in WORKSPACE_ROOT.iterdir() if p.is_dir()) if WORKSPACE_ROOT.exists() else 0,
        "gemini_model": "gemini-2.5-flash-image",
    }
