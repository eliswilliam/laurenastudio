"""
Comprehensive test for LAURENA CODE editor — file ops, terminal, language support.
Run from the project root:
    python test_laurena_code.py
"""
import json
import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

WORKSPACE_ROOT = Path(__file__).resolve().parent / "backend" / "workspaces"
WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)

TEST_PROJECT = "__test_laurena__"
TEST_DIR = WORKSPACE_ROOT / TEST_PROJECT

results: list[dict] = []


def _safe(s: str) -> str:
    return s.encode("ascii", errors="replace").decode("ascii")


def ok(name: str, detail: str = ""):
    results.append({"test": name, "status": "PASS", "detail": detail})
    print(f"  [PASS] {_safe(name)}" + (f" - {_safe(detail)}" if detail else ""))


def fail(name: str, error: str):
    results.append({"test": name, "status": "FAIL", "detail": error})
    print(f"  [FAIL] {_safe(name)} - {_safe(error)}")


def cleanup():
    if TEST_DIR.exists():
        shutil.rmtree(TEST_DIR)


def test_imports():
    """Test that all backend modules import without error."""
    print("\n== Test: Imports ==")
    try:
        from app.schemas.laurena_code import (
            AVAILABLE_MODELS, ChatRequest, ChatResponse,
            CreateProjectRequest, CreateProjectResponse,
            FileNode, TerminalCommandResponse,
            CreateFileRequest, CreateFolderRequest,
            DeleteFileRequest, RenameFileRequest,
        )
        ok("schemas import")
    except Exception as e:
        fail("schemas import", str(e))

    try:
        from app.services.laurena_code_service import (
            list_directory, read_file, write_file, create_file,
            create_folder, delete_file, rename_file,
            save_uploaded_file, execute_command,
            _get_language, _normalize_path,
            WORKSPACE_ROOT as WR,
        )
        ok("service import")
    except Exception as e:
        fail("service import", str(e))


def test_language_detection():
    """Test language detection for all supported extensions."""
    print("\n== Test: Language Detection ==")
    from app.services.laurena_code_service import _get_language

    extensions = {
        ".py": "python", ".js": "javascript", ".ts": "typescript",
        ".tsx": "typescriptreact", ".jsx": "javascriptreact",
        ".html": "html", ".css": "css", ".scss": "scss",
        ".json": "json", ".yaml": "yaml", ".yml": "yaml",
        ".md": "markdown", ".sql": "sql", ".sh": "shell",
        ".ps1": "powershell", ".bat": "bat", ".cmd": "bat",
        ".go": "go", ".rs": "rust", ".java": "java",
        ".kt": "kotlin", ".swift": "swift", ".rb": "ruby",
        ".php": "php", ".c": "c", ".cpp": "cpp",
        ".cs": "csharp", ".dart": "dart", ".lua": "lua",
        ".r": "r", ".pl": "perl", ".scala": "scala",
        ".vue": "vue", ".svelte": "svelte",
        ".toml": "toml", ".xml": "xml", ".env": "dotenv",
        ".ini": "ini", ".txt": "plaintext",
    }

    passed = 0
    failed_langs = []
    for ext, expected in extensions.items():
        result = _get_language(ext)
        if result == expected:
            passed += 1
        else:
            failed_langs.append(f"{ext}: got '{result}', expected '{expected}'")

    if failed_langs:
        fail(f"language detection ({passed}/{len(extensions)})", "; ".join(failed_langs))
    else:
        ok(f"language detection ({passed}/{len(extensions)} extensions)")


def test_file_operations():
    """Test create, read, write, rename, delete file operations."""
    print("\n== Test: File Operations ==")
    from app.services.laurena_code_service import (
        create_file, read_file, write_file, delete_file,
        rename_file, list_directory, create_folder,
        save_uploaded_file,
    )

    base = str(TEST_DIR)
    TEST_DIR.mkdir(parents=True, exist_ok=True)

    # Create files for each language
    test_files = {
        "main.py": "print('Hello Python')\n",
        "main.js": "console.log('Hello JS');\n",
        "main.ts": "console.log('Hello TS');\n",
        "Main.java": "public class Main { public static void main(String[] a) {} }\n",
        "main.go": 'package main\nimport "fmt"\nfunc main() { fmt.Println("Hi") }\n',
        "main.rs": 'fn main() { println!("Hi"); }\n',
        "main.c": '#include <stdio.h>\nint main() { printf("Hi"); return 0; }\n',
        "main.cpp": '#include <iostream>\nint main() { std::cout << "Hi"; return 0; }\n',
        "main.cs": 'using System;\nclass P { static void Main() { Console.WriteLine("Hi"); } }\n',
        "main.dart": 'void main() { print("Hi"); }\n',
        "main.lua": 'print("Hi")\n',
        "main.r": 'cat("Hi\\n")\n',
        "main.pl": 'print "Hi\\n";\n',
        "main.rb": 'puts "Hi"\n',
        "main.php": '<?php echo "Hi\\n"; ?>\n',
        "main.swift": 'print("Hi")\n',
        "main.kt": 'fun main() { println("Hi") }\n',
        "main.scala": 'object Main extends App { println("Hi") }\n',
        "script.sh": '#!/bin/bash\necho "Hi"\n',
        "script.ps1": 'Write-Host "Hi"\n',
        "script.bat": '@echo off\necho Hi\n',
        "index.html": "<!DOCTYPE html><html><body>Hi</body></html>\n",
        "style.css": "body { color: red; }\n",
        "data.json": '{"hello": "world"}\n',
        "config.yaml": "key: value\n",
        "README.md": "# Test\n",
        "query.sql": "SELECT 1;\n",
        "Dockerfile": "FROM alpine\n",
        "app.xml": '<?xml version="1.0"?><root/>\n',
        "config.toml": '[section]\nkey = "val"\n',
        "note.txt": "Plain text\n",
    }

    created = 0
    for filename, content in test_files.items():
        try:
            create_file(base, filename, content)
            created += 1
        except FileExistsError:
            created += 1  # already exists from previous run
        except Exception as e:
            fail(f"create {filename}", str(e))

    if created == len(test_files):
        ok(f"create {created} files in {len(test_files)} languages")
    else:
        fail(f"create files", f"only {created}/{len(test_files)} created")

    # Read files
    read_ok = 0
    for filename in test_files:
        try:
            content, lang = read_file(base, filename)
            if content:
                read_ok += 1
            else:
                fail(f"read {filename}", "empty content")
        except Exception as e:
            fail(f"read {filename}", str(e))

    if read_ok == len(test_files):
        ok(f"read {read_ok} files")

    # Write (update) a file
    try:
        write_file(base, "main.py", "print('Updated!')\n")
        content, _ = read_file(base, "main.py")
        assert "Updated" in content
        ok("write/update file")
    except Exception as e:
        fail("write/update file", str(e))

    # Rename
    try:
        create_file(base, "to_rename.txt", "test")
        rename_file(base, "to_rename.txt", "renamed.txt")
        content, _ = read_file(base, "renamed.txt")
        assert content == "test"
        ok("rename file")
    except Exception as e:
        fail("rename file", str(e))

    # Delete
    try:
        delete_file(base, "renamed.txt")
        ok("delete file")
    except Exception as e:
        fail("delete file", str(e))

    # Upload (binary)
    try:
        save_uploaded_file(base, "uploaded.bin", b"\x00\x01\x02\x03")
        assert (TEST_DIR / "uploaded.bin").exists()
        ok("save uploaded file")
    except Exception as e:
        fail("save uploaded file", str(e))

    # List directory
    try:
        nodes = list_directory(base)
        assert len(nodes) > 0
        ok(f"list directory ({len(nodes)} items)")
    except Exception as e:
        fail("list directory", str(e))

    # Path normalization (Windows backslashes)
    from app.services.laurena_code_service import _normalize_path
    try:
        base_p = Path("C:/test/base")
        child_p = Path("C:/test/base/sub/file.txt")
        result = _normalize_path(child_p, base_p)
        assert "\\" not in result, f"Got backslashes: {result}"
        assert result == "sub/file.txt"
        ok("path normalization (forward slashes)")
    except Exception as e:
        fail("path normalization", str(e))


def test_create_folder():
    """Test folder creation for project setup."""
    print("\n== Test: Folder Creation ==")
    from app.services.laurena_code_service import create_folder, list_directory

    base = str(TEST_DIR)
    try:
        create_folder(base, "subfolder/nested")
        assert (TEST_DIR / "subfolder" / "nested").is_dir()
        ok("create nested folder")
    except Exception as e:
        fail("create nested folder", str(e))


def test_terminal_sync():
    """Test terminal command execution (synchronous check)."""
    print("\n== Test: Terminal (sync validation) ==")
    from app.services.laurena_code_service import DANGEROUS_PATTERNS

    # Verify dangerous commands are blocked
    for cmd in ["rm -rf /", "format c:", "dd if=/dev/zero"]:
        blocked = any(d in cmd.lower() for d in DANGEROUS_PATTERNS)
        if blocked:
            ok(f"blocks '{cmd[:20]}...'")
        else:
            fail(f"blocks '{cmd[:20]}...'", "not blocked!")


async def test_terminal_async():
    """Test actual terminal command execution."""
    print("\n== Test: Terminal (async execution) ==")
    from app.services.laurena_code_service import execute_command

    # Basic echo
    r = await execute_command("echo Hello LAURENA CODE", TEST_PROJECT)
    if "Hello LAURENA CODE" in (r.stdout or ""):
        ok("echo command", r.stdout.strip()[:50])
    else:
        fail("echo command", f"stdout='{r.stdout}', stderr='{r.stderr}'")

    # Python version
    r = await execute_command("python --version", TEST_PROJECT)
    out = (r.stdout + r.stderr).strip()
    if "Python" in out:
        ok("python --version", out[:50])
    else:
        fail("python --version", f"out='{out}'")

    # Run a Python file
    from app.services.laurena_code_service import write_file
    write_file(str(TEST_DIR), "test_run.py", "print('EXEC_OK')")
    r = await execute_command('python test_run.py', TEST_PROJECT)
    if "EXEC_OK" in (r.stdout or ""):
        ok("run python file", "output: EXEC_OK")
    else:
        fail("run python file", f"stdout='{r.stdout}', stderr='{r.stderr}'")

    # PowerShell (Windows)
    if sys.platform == "win32":
        write_file(str(TEST_DIR), "test.ps1", 'Write-Host "PS_OK"')
        r = await execute_command('powershell -File test.ps1', TEST_PROJECT)
        if "PS_OK" in (r.stdout or ""):
            ok("run powershell script", "output: PS_OK")
        else:
            fail("run powershell script", f"stdout='{r.stdout}', stderr='{r.stderr}'")

        # Batch
        write_file(str(TEST_DIR), "test.bat", '@echo off\necho BAT_OK')
        r = await execute_command('test.bat', TEST_PROJECT)
        if "BAT_OK" in (r.stdout or ""):
            ok("run batch script", "output: BAT_OK")
        else:
            fail("run batch script", f"stdout='{r.stdout}', stderr='{r.stderr}'")

    # Node.js (if available)
    write_file(str(TEST_DIR), "test.js", 'console.log("NODE_OK")')
    r = await execute_command('node test.js', TEST_PROJECT)
    if "NODE_OK" in (r.stdout or ""):
        ok("run node.js file", "output: NODE_OK")
    else:
        fail("run node.js file", f"stdout='{r.stdout}', stderr='{r.stderr}' (node may not be installed)")

    # Timeout handling
    r = await execute_command("echo timeout_test", TEST_PROJECT)
    if r.exit_code == 0:
        ok("command with exit code 0")

    # Blocked dangerous command
    r = await execute_command("rm -rf /", TEST_PROJECT)
    if r.exit_code != 0:
        ok("dangerous command blocked", r.stderr[:50])
    else:
        fail("dangerous command blocked", "was not blocked!")


def test_models_schema():
    """Test that available models are defined."""
    print("\n== Test: Models Schema ==")
    from app.schemas.laurena_code import AVAILABLE_MODELS

    if len(AVAILABLE_MODELS) > 0:
        names = [m.name for m in AVAILABLE_MODELS]
        ok(f"models defined ({len(AVAILABLE_MODELS)})", ", ".join(names[:5]))
    else:
        fail("models defined", "no models found")


def print_summary():
    print("\n" + "=" * 70)
    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = sum(1 for r in results if r["status"] == "FAIL")
    total = len(results)
    print(f"  TOTAL: {total}  |  PASS: {passed}  |  FAIL: {failed}")

    if failed > 0:
        print("\n  Failed tests:")
        for r in results:
            if r["status"] == "FAIL":
                print(f"    - {r['test']}: {r['detail']}")

    print("=" * 70)
    return failed == 0


import asyncio

if __name__ == "__main__":
    print("=" * 70)
    print("  LAURENA CODE — Comprehensive Test Suite")
    print("=" * 70)

    cleanup()
    TEST_DIR.mkdir(parents=True, exist_ok=True)

    test_imports()
    test_language_detection()
    test_file_operations()
    test_create_folder()
    test_terminal_sync()
    test_models_schema()

    # Run async tests
    asyncio.run(test_terminal_async())

    all_pass = print_summary()

    # Cleanup
    cleanup()

    sys.exit(0 if all_pass else 1)
