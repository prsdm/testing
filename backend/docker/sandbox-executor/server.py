#!/usr/bin/env python3
"""Local sandbox executor — POST /v1/exec for Phase 0 dev."""

from __future__ import annotations

import json
import mimetypes
import os
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from path_jail import (
    SandboxPathError,
    get_session_directory_path,
    resolve_session_cwd,
)

SESSIONS_ROOT = os.environ.get("SANDBOX_SESSIONS_ROOT", "/workspace/sessions")
DEFAULT_TIMEOUT_MS = int(os.environ.get("SANDBOX_DEFAULT_TIMEOUT_MS", "60000"))
MAX_TIMEOUT_MS = int(os.environ.get("SANDBOX_MAX_TIMEOUT_MS", "300000"))
MAX_STDIO_BYTES = int(os.environ.get("SANDBOX_MAX_STDIO_BYTES", str(256 * 1024)))
MAX_OUTPUT_FILE_BYTES = int(
    os.environ.get("SANDBOX_MAX_OUTPUT_FILE_BYTES", str(15 * 1024 * 1024))
)
MAX_OUTPUT_FILES = int(os.environ.get("SANDBOX_MAX_OUTPUT_FILES", "20"))
ALLOWED_COMMANDS = frozenset({"python", "python3", "bash"})
SYNC_SUBDIRS = ("uploads", "staging", "outputs", "scripts")
PORT = int(os.environ.get("PORT", "8089"))


def ensure_session_layout(session_root: str) -> None:
    for name in (*SYNC_SUBDIRS, ".meta"):
        Path(session_root, name).mkdir(parents=True, exist_ok=True)


def truncate_bytes(value: bytes, limit: int) -> tuple[str, bool]:
    truncated = len(value) > limit
    clipped = value[:limit]
    return clipped.decode("utf-8", errors="replace"), truncated


def list_sync_files(session_root: str) -> list[dict[str, Any]]:
    files: list[dict[str, Any]] = []
    for subdir in SYNC_SUBDIRS:
        base = Path(session_root, subdir)
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file():
                continue
            if path.name.startswith("."):
                continue
            rel = path.relative_to(session_root).as_posix()
            size = path.stat().st_size
            if size > MAX_OUTPUT_FILE_BYTES:
                continue
            content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            files.append(
                {
                    "path": rel,
                    "sizeBytes": size,
                    "contentType": content_type,
                }
            )
            if len(files) >= MAX_OUTPUT_FILES:
                return files
    return files


def run_exec(payload: dict[str, Any]) -> dict[str, Any]:
    started = time.monotonic()
    tenant_id = str(payload.get("tenantId", ""))
    user_id = str(payload.get("userId", ""))
    chat_id = str(payload.get("chatId", ""))
    command = str(payload.get("command", "")).strip()
    args = payload.get("args") or []
    cwd = str(payload.get("cwd") or ".").strip()
    timeout_ms = int(payload.get("timeoutMs") or DEFAULT_TIMEOUT_MS)

    if command not in ALLOWED_COMMANDS:
        return {
            "ok": False,
            "error": f"Unsupported command: {command!r}. Allowed: {sorted(ALLOWED_COMMANDS)}",
        }

    if not isinstance(args, list) or not all(isinstance(item, str) for item in args):
        return {"ok": False, "error": "args must be an array of strings."}

    timeout_ms = max(1, min(timeout_ms, MAX_TIMEOUT_MS))
    timeout_sec = timeout_ms / 1000

    try:
        session_root = get_session_directory_path(
            sessions_root=SESSIONS_ROOT,
            tenant_id=tenant_id,
            user_id=user_id,
            chat_id=chat_id,
        )
        ensure_session_layout(session_root)
        resolved_cwd = resolve_session_cwd(
            session_root=session_root,
            relative_path=cwd,
        )
    except SandboxPathError as exc:
        return {"ok": False, "error": str(exc)}

    if not os.path.isdir(resolved_cwd):
        return {"ok": False, "error": f"Working directory does not exist: {cwd}"}

    executable = "python3" if command == "python" else command
    try:
        completed = subprocess.run(
            [executable, *args],
            cwd=resolved_cwd,
            capture_output=True,
            timeout=timeout_sec,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        stdout, stdout_truncated = truncate_bytes(exc.stdout or b"", MAX_STDIO_BYTES)
        stderr, stderr_truncated = truncate_bytes(
            (exc.stderr or b"") + b"\nProcess timed out.",
            MAX_STDIO_BYTES,
        )
        return {
            "ok": False,
            "exitCode": None,
            "stdout": stdout,
            "stderr": stderr,
            "stdoutTruncated": stdout_truncated,
            "stderrTruncated": stderr_truncated,
            "outputFiles": list_sync_files(session_root),
            "durationMs": int((time.monotonic() - started) * 1000),
            "error": "Process timed out.",
        }

    stdout, stdout_truncated = truncate_bytes(completed.stdout, MAX_STDIO_BYTES)
    stderr, stderr_truncated = truncate_bytes(completed.stderr, MAX_STDIO_BYTES)

    return {
        "ok": completed.returncode == 0,
        "exitCode": completed.returncode,
        "stdout": stdout,
        "stderr": stderr,
        "stdoutTruncated": stdout_truncated,
        "stderrTruncated": stderr_truncated,
        "outputFiles": list_sync_files(session_root),
        "durationMs": int((time.monotonic() - started) * 1000),
    }


class SandboxHandler(BaseHTTPRequestHandler):
    server_version = "sandbox-executor/0.1"

    def log_message(self, format: str, *args: Any) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send_json(
                200,
                {
                    "ok": True,
                    "service": "sandbox-executor",
                    "sessionsRoot": SESSIONS_ROOT,
                },
            )
            return
        self._send_json(404, {"ok": False, "error": "Not found."})

    def do_POST(self) -> None:
        if self.path != "/v1/exec":
            self._send_json(404, {"ok": False, "error": "Not found."})
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._send_json(400, {"ok": False, "error": "Invalid JSON body."})
            return

        if not isinstance(payload, dict):
            self._send_json(400, {"ok": False, "error": "JSON body must be an object."})
            return

        result = run_exec(payload)
        status = 200 if result.get("ok") or "exitCode" in result else 400
        if result.get("error") and "exitCode" not in result:
            status = 400
        self._send_json(status, result)


def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", PORT), SandboxHandler)
    print(f"sandbox-executor listening on :{PORT} (sessions={SESSIONS_ROOT})")
    server.serve_forever()


if __name__ == "__main__":
    main()
