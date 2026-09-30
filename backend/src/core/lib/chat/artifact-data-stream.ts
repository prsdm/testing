/**
 * Side-panel artifact streaming (createDocument / updateDocument).
 *
 * Artifact chunks are pushed to the in-memory run registry and consumed by
 * GET /api/chat/[id]/runs/[runId]/artifacts (NDJSON).
 */
export type ArtifactStreamPart = {
  type: string;
  data: unknown;
  transient?: boolean;
};

export type ArtifactStreamSink = {
  push(part: ArtifactStreamPart): void;
};

export const ARTIFACT_STREAM_SINK_KEY = "artifactStreamSink" as const;

export type ArtifactDataStreamWriter = {
  write(part: ArtifactStreamPart): void;
};

export function createArtifactStreamSink(): ArtifactStreamSink {
  return {
    push() {
      // Wired when createChatArtifactSink is registered for the run.
    },
  };
}

export function createArtifactDataStreamWriter(
  sink: ArtifactStreamSink
): ArtifactDataStreamWriter {
  return {
    write(part) {
      sink.push(part);
    },
  };
}
