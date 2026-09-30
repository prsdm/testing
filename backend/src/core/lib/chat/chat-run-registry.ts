import type { ArtifactStreamPart } from "@/core/lib/chat/artifact-data-stream";

const abortControllers = new Map<string, AbortController>();

type ArtifactEntry = {
  parts: ArtifactStreamPart[];
  listeners: Set<(part: ArtifactStreamPart) => void>;
};

const artifactEntries = new Map<string, ArtifactEntry>();

export function registerChatRunAbort(runId: string): AbortSignal {
  const existing = abortControllers.get(runId);
  if (existing) {
    return existing.signal;
  }
  const controller = new AbortController();
  abortControllers.set(runId, controller);
  return controller.signal;
}

export function cancelChatRunAbort(runId: string) {
  abortControllers.get(runId)?.abort();
  abortControllers.delete(runId);
}

export function clearChatRunAbort(runId: string) {
  abortControllers.delete(runId);
}

export function createChatArtifactSink(runId: string) {
  let entry = artifactEntries.get(runId);
  if (!entry) {
    entry = { listeners: new Set(), parts: [] };
    artifactEntries.set(runId, entry);
  }
  return {
    push(part: ArtifactStreamPart) {
      const current = artifactEntries.get(runId);
      if (!current) {
        return;
      }
      current.parts.push(part);
      for (const listener of current.listeners) {
        listener(part);
      }
    },
  };
}

export function subscribeChatArtifactStream(
  runId: string,
  listener: (part: ArtifactStreamPart) => void,
  replay = true
) {
  let entry = artifactEntries.get(runId);
  if (!entry) {
    entry = { listeners: new Set(), parts: [] };
    artifactEntries.set(runId, entry);
  }
  entry.listeners.add(listener);
  if (replay) {
    for (const part of entry.parts) {
      listener(part);
    }
  }
  return () => {
    entry?.listeners.delete(listener);
  };
}

export function clearChatArtifactStream(runId: string) {
  artifactEntries.delete(runId);
}
