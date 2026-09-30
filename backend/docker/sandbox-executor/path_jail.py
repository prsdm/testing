"""Path jail for sandbox executor — mirrors lib/sandbox/path-jail.ts."""

from __future__ import annotations

import os
from dataclasses import dataclass

SESSION_SUBDIRS = frozenset({"uploads", "staging", "outputs", "scripts"})


class SandboxPathError(ValueError):
    pass


@dataclass(frozen=True)
class ResolvedSessionPath:
    absolute_path: str
    relative_path: str


def _normalize_absolute(value: str) -> str:
    return os.path.abspath(value.replace("\\", "/"))


def _validate_id(label: str, value: str) -> str:
    trimmed = value.strip()
    if not trimmed or "/" in trimmed or ".." in trimmed:
        raise SandboxPathError(f"Invalid {label} id.")
    return trimmed


def get_session_directory_path(
    *,
    sessions_root: str,
    tenant_id: str,
    user_id: str,
    chat_id: str,
) -> str:
    tenant = _validate_id("tenant", tenant_id)
    user = _validate_id("user", user_id)
    chat = _validate_id("chat", chat_id)
    return os.path.join(
        _normalize_absolute(sessions_root),
        tenant,
        user,
        "sessions",
        chat,
    )


def resolve_session_cwd(*, session_root: str, relative_path: str) -> str:
    trimmed = relative_path.strip().replace("\\", "/")
    if not trimmed or trimmed == ".":
        return _normalize_absolute(session_root)
    return resolve_session_path(
        session_root=session_root,
        relative_path=trimmed,
    ).absolute_path


def resolve_session_path(*, session_root: str, relative_path: str) -> ResolvedSessionPath:
    session_root = _normalize_absolute(session_root)
    trimmed = relative_path.strip().replace("\\", "/")
    if not trimmed or trimmed == ".":
        raise SandboxPathError("Path is required.")
    if trimmed.startswith("/"):
        raise SandboxPathError("Absolute paths are not allowed.")
    if "\0" in trimmed:
        raise SandboxPathError("Invalid path.")

    segments = [segment for segment in trimmed.split("/") if segment]
    if any(segment == ".." for segment in segments):
        raise SandboxPathError("Path traversal is not allowed.")

    top_level = segments[0]
    if top_level not in SESSION_SUBDIRS:
        allowed = ", ".join(sorted(SESSION_SUBDIRS))
        raise SandboxPathError(f"Path must start with one of: {allowed}")

    if any(segment.startswith(".") for segment in segments):
        raise SandboxPathError("Hidden paths are not allowed.")

    absolute_path = os.path.abspath(os.path.join(session_root, *segments))
    if absolute_path != session_root and not absolute_path.startswith(
        session_root + os.sep
    ):
        raise SandboxPathError("Path escapes session directory.")

    return ResolvedSessionPath(
        absolute_path=absolute_path,
        relative_path="/".join(segments),
    )
