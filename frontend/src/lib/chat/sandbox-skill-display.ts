export function isSandboxSkillLoadCode(code: string | undefined): boolean {
  if (!code?.trim()) {
    return false;
  }

  const normalized = code.trim();
  if (!/\.kimiro\/skills\/[a-z0-9-]+\/SKILL\.md/i.test(normalized)) {
    return false;
  }

  return (
    /\b(?:cat|head|tail|less|more|type)\b[^\n]*SKILL\.md/i.test(normalized) ||
    /open\s*\([^)]*SKILL\.md/i.test(normalized) ||
    /\.read(?:_text)?\s*\([^)]*SKILL\.md/i.test(normalized)
  );
}

export function looksLikeSkillMarkdown(stdout: string | undefined): boolean {
  const text = stdout?.trim() ?? "";
  return text.startsWith("---") && /\nname:\s*\S+/m.test(text);
}

export function shouldHideSandboxSkillStdout(args: {
  code?: string;
  stdout?: string;
}): boolean {
  return (
    isSandboxSkillLoadCode(args.code) || looksLikeSkillMarkdown(args.stdout)
  );
}

function formatToolLabel(noun: string): string {
  return noun === "PDF" ? "PDF" : noun.toLowerCase();
}

export function sandboxSkillToolLabel(args: {
  formatNoun: string;
  phase: "pending" | "completed";
  isLoad: boolean;
}): string {
  const label = formatToolLabel(args.formatNoun);
  if (args.isLoad) {
    return args.phase === "pending" ? `Loading ${label}` : `Loaded ${label}`;
  }
  return args.phase === "pending" ? `Using ${label}` : `Used ${label}`;
}

export function sandboxSkillToolFailedLabel(formatNoun: string): string {
  return `${formatToolLabel(formatNoun)} failed`;
}

export function sandboxSkillToolInterruptedLabel(formatNoun: string): string {
  return `${formatToolLabel(formatNoun)} interrupted`;
}
