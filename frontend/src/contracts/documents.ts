import type { ArtifactKind } from "./artifact";

export type Vote = {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
};

export type Document = {
  id: string;
  createdAt: string | Date;
  title: string;
  content: string | null;
  kind: ArtifactKind;
  userId: string;
  driveFileId: string | null;
  driveWebViewLink: string | null;
};

export type Suggestion = {
  id: string;
  documentId: string;
  documentCreatedAt: string | Date;
  originalText: string;
  suggestedText: string;
  description: string | null;
  isResolved: boolean;
  userId: string;
  createdAt: string | Date;
};
