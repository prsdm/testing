"use client";

import type { CustomUIDataTypes, DataUIPart } from "@/shared/types";

type ArtifactStreamListener = (
  chatId: string,
  part: DataUIPart<CustomUIDataTypes>
) => void;

let listener: ArtifactStreamListener | null = null;

export function setArtifactStreamListener(next: ArtifactStreamListener | null) {
  listener = next;
}

export function dispatchArtifactStreamPart(
  chatId: string,
  part: DataUIPart<CustomUIDataTypes>
) {
  listener?.(chatId, part);
}
