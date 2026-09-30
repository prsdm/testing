const STOPPED_RUNS_STORAGE_KEY = "chat-stopped-workflow-runs";
const MAX_STOPPED_RUNS = 64;

function stoppedRunKey(chatId: string, runId: string) {
  return `${chatId}:${runId}`;
}

function readStoppedRunKeys(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.sessionStorage.getItem(STOPPED_RUNS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function writeStoppedRunKeys(keys: string[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(
    STOPPED_RUNS_STORAGE_KEY,
    JSON.stringify(keys.slice(-MAX_STOPPED_RUNS))
  );
}

export function markWorkflowRunStopped(chatId: string, runId: string) {
  const key = stoppedRunKey(chatId, runId);
  const keys = readStoppedRunKeys();
  if (!keys.includes(key)) {
    writeStoppedRunKeys([...keys, key]);
  }
}

export function clearWorkflowRunStopped(chatId: string, runId: string) {
  const key = stoppedRunKey(chatId, runId);
  writeStoppedRunKeys(readStoppedRunKeys().filter((entry) => entry !== key));
}

export function clearStoppedWorkflowRunsForChat(chatId: string) {
  writeStoppedRunKeys(
    readStoppedRunKeys().filter((entry) => !entry.startsWith(`${chatId}:`))
  );
}

export function isWorkflowRunStopped(chatId: string, runId: string): boolean {
  return readStoppedRunKeys().includes(stoppedRunKey(chatId, runId));
}
