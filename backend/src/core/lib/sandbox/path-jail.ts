import path from "node:path";

const SESSION_SUBDIRS = new Set(["uploads", "staging", "outputs", "scripts"]);

const HIDDEN_ENTRY_NAMES = new Set([".meta", ".setup.lock"]);

export type ResolvedSessionPath = {
  absolutePath: string;
  relativePath: string;
};

/** Resolve a user/agent path to an absolute path inside the chat session directory. */
export function resolveSessionListingPath(args: {
  sessionRoot: string;
  relativePath: string;
}): ResolvedSessionPath {
  const sessionRoot = normalizeAbsolute(args.sessionRoot);
  const trimmed = args.relativePath.trim().replaceAll("\\", "/");

  if (trimmed.includes("\0")) {
    throw new SandboxPathError("Invalid path.");
  }

  if (!trimmed || trimmed === ".") {
    return {
      absolutePath: sessionRoot,
      relativePath: "",
    };
  }

  if (trimmed.startsWith("/")) {
    throw new SandboxPathError("Absolute paths are not allowed.");
  }

  const segments = trimmed.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "..")) {
    throw new SandboxPathError("Path traversal is not allowed.");
  }

  const absolutePath = path.resolve(sessionRoot, ...segments);
  if (
    absolutePath !== sessionRoot &&
    !absolutePath.startsWith(`${sessionRoot}${path.sep}`)
  ) {
    throw new SandboxPathError("Path escapes session directory.");
  }

  return {
    absolutePath,
    relativePath: segments.join("/"),
  };
}

export function isHiddenWorkspaceEntry(name: string): boolean {
  return HIDDEN_ENTRY_NAMES.has(name) || name.startsWith(".");
}

export function resolveSessionPath(args: {
  sessionRoot: string;
  relativePath: string;
}): ResolvedSessionPath {
  const sessionRoot = normalizeAbsolute(args.sessionRoot);
  const trimmed = args.relativePath.trim().replaceAll("\\", "/");
  if (!trimmed || trimmed === ".") {
    throw new SandboxPathError("Path is required.");
  }
  if (trimmed.startsWith("/")) {
    throw new SandboxPathError("Absolute paths are not allowed.");
  }
  if (trimmed.includes("\0")) {
    throw new SandboxPathError("Invalid path.");
  }

  const segments = trimmed.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "..")) {
    throw new SandboxPathError("Path traversal is not allowed.");
  }

  const topLevel = segments[0];
  if (!topLevel || !SESSION_SUBDIRS.has(topLevel)) {
    throw new SandboxPathError(
      `Path must start with one of: ${[...SESSION_SUBDIRS].join(", ")}`
    );
  }

  if (segments.some((segment) => segment.startsWith("."))) {
    throw new SandboxPathError("Hidden paths are not allowed.");
  }

  const absolutePath = path.resolve(sessionRoot, ...segments);
  if (
    absolutePath !== sessionRoot &&
    !absolutePath.startsWith(`${sessionRoot}${path.sep}`)
  ) {
    throw new SandboxPathError("Path escapes session directory.");
  }

  return {
    absolutePath,
    relativePath: segments.join("/"),
  };
}

export function getSessionDirectoryPath(args: {
  sessionsRoot: string;
  tenantId: string;
  userId: string;
  chatId: string;
}): string {
  for (const [label, value] of [
    ["tenant", args.tenantId],
    ["user", args.userId],
    ["chat", args.chatId],
  ] as const) {
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes("/") || trimmed.includes("..")) {
      throw new SandboxPathError(`Invalid ${label} id.`);
    }
  }

  return path.join(
    normalizeAbsolute(args.sessionsRoot),
    args.tenantId.trim(),
    args.userId.trim(),
    "sessions",
    args.chatId.trim()
  );
}

function normalizeAbsolute(value: string): string {
  return path.resolve(value.replaceAll("\\", "/"));
}

export class SandboxPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxPathError";
  }
}
