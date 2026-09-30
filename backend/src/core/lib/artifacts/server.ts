import type { ArtifactKind } from "@/contracts/artifact";
import { codeDocumentHandler } from "@/core/artifacts/code/server";
import { sheetDocumentHandler } from "@/core/artifacts/sheet/server";
import { textDocumentHandler } from "@/core/artifacts/text/server";
import type { StreamBillingContext } from "@/core/lib/billing/record-stream-usage";
import type { ArtifactDataStreamWriter } from "@/core/lib/chat/artifact-data-stream";
import type { ResolvedTenantLlmKeys } from "@/core/lib/db/llm-provider-queries";
import type { AppSession } from "@/shared/auth/types";
import { saveDocument } from "../db/queries";
import type { Document } from "../db/schema";

export type SaveDocumentProps = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
};

export type CreateDocumentCallbackProps = {
  id: string;
  title: string;
  /** Full generation brief; falls back to title when omitted. */
  instructions?: string;
  dataStream: ArtifactDataStreamWriter;
  session: AppSession;
  modelId: string;
  llmKeys: ResolvedTenantLlmKeys;
  billing?: Pick<StreamBillingContext, "tenantId" | "authUserId" | "chatId">;
};

export type UpdateDocumentCallbackProps = {
  document: Document;
  description: string;
  /** When set, rewrite only this passage instead of the whole document. */
  selectedText?: string;
  dataStream: ArtifactDataStreamWriter;
  session: AppSession;
  modelId: string;
  llmKeys: ResolvedTenantLlmKeys;
  billing?: Pick<StreamBillingContext, "tenantId" | "authUserId" | "chatId">;
};

export type DocumentHandler<T = ArtifactKind> = {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
};

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      const draftContent = await config.onCreateDocument({
        dataStream: args.dataStream,
        id: args.id,
        instructions: args.instructions,
        llmKeys: args.llmKeys,
        modelId: args.modelId,
        session: args.session,
        title: args.title,
      });

      if (args.session?.user?.id) {
        await saveDocument({
          content: draftContent,
          id: args.id,
          kind: config.kind,
          title: args.title,
          userId: args.session.user.id,
        });
      }
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      const draftContent = await config.onUpdateDocument({
        dataStream: args.dataStream,
        description: args.description,
        document: args.document,
        llmKeys: args.llmKeys,
        modelId: args.modelId,
        selectedText: args.selectedText,
        session: args.session,
      });

      if (args.session?.user?.id) {
        await saveDocument({
          content: draftContent,
          id: args.document.id,
          kind: config.kind,
          title: args.document.title,
          userId: args.session.user.id,
        });
      }
    },
  };
}

export const documentHandlersByArtifactKind: DocumentHandler[] = [
  textDocumentHandler,
  codeDocumentHandler,
  sheetDocumentHandler,
];

export const artifactKinds = ["text", "code", "sheet"] as const;
