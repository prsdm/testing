export function formatWorkspacePrompt(workspacePrompt: string | null) {
  const trimmed = workspacePrompt?.trim();
  if (!trimmed) {
    return;
  }

  return `# Workspace prompt

${trimmed}`;
}
