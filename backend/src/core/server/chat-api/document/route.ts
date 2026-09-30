import { z } from "zod";
import type { ArtifactKind } from "@/contracts/artifact";
import { auth } from "@/core/lib/auth/server-session";
import { assertChatApiAccess } from "@/core/lib/chat/assert-chat-api-access";
import {
  deleteDocumentsByIdAfterTimestamp,
  getDocumentsById,
  saveDocument,
  toTenantUserId,
  updateDocumentContent,
  withTenantForUser,
} from "@/core/lib/db/queries";
import { ChatbotError } from "@/shared/errors";

async function requireDocumentAccess(session: {
  user: { id: string; email?: string | null };
}) {
  if (!session.user.email) {
    return new ChatbotError("unauthorized:document").toResponse();
  }
  if (
    (await assertChatApiAccess({
      userEmail: session.user.email,
      userId: session.user.id,
    })) === "forbidden"
  ) {
    return new ChatbotError("forbidden:document").toResponse();
  }
  return null;
}

const documentSchema = z.object({
  content: z.string(),
  isManualEdit: z.boolean().optional(),
  kind: z.enum(["text", "code", "image", "sheet"]),
  title: z.string(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError(
      "bad_request:api",
      "Parameter id is missing"
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:document").toResponse();
  }
  const documentDenied = await requireDocumentAccess(session);
  if (documentDenied) {
    return documentDenied;
  }

  const userId = toTenantUserId(session.user.id);
  const documents = await withTenantForUser(session.user, async () =>
    getDocumentsById({ id, userId })
  );

  if (documents.length === 0) {
    return new ChatbotError("not_found:document").toResponse();
  }

  return Response.json(documents, { status: 200 });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError(
      "bad_request:api",
      "Parameter id is required."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("not_found:document").toResponse();
  }
  const documentDenied = await requireDocumentAccess(session);
  if (documentDenied) {
    return documentDenied;
  }

  let content: string;
  let title: string;
  let kind: ArtifactKind;
  let isManualEdit: boolean | undefined;

  try {
    const parsed = documentSchema.parse(await request.json());
    content = parsed.content;
    title = parsed.title;
    kind = parsed.kind;
    isManualEdit = parsed.isManualEdit;
  } catch {
    return new ChatbotError(
      "bad_request:api",
      "Invalid request body."
    ).toResponse();
  }

  const userId = toTenantUserId(session.user.id);
  const documents = await withTenantForUser(session.user, async () =>
    getDocumentsById({ id, userId })
  );

  if (isManualEdit && documents.length > 0) {
    const result = await withTenantForUser(session.user, async () =>
      updateDocumentContent({ content, id, userId })
    );
    return Response.json(result, { status: 200 });
  }

  const document = await withTenantForUser(session.user, async () =>
    saveDocument({
      content,
      id,
      kind,
      title,
      userId,
    })
  );

  return Response.json(document, { status: 200 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const timestamp = searchParams.get("timestamp");

  if (!id) {
    return new ChatbotError(
      "bad_request:api",
      "Parameter id is required."
    ).toResponse();
  }

  if (!timestamp) {
    return new ChatbotError(
      "bad_request:api",
      "Parameter timestamp is required."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:document").toResponse();
  }
  const documentDenied = await requireDocumentAccess(session);
  if (documentDenied) {
    return documentDenied;
  }

  const userId = toTenantUserId(session.user.id);
  const documents = await withTenantForUser(session.user, async () =>
    getDocumentsById({ id, userId })
  );

  if (documents.length === 0) {
    return new ChatbotError("not_found:document").toResponse();
  }

  const parsedTimestamp = new Date(timestamp);

  if (Number.isNaN(parsedTimestamp.getTime())) {
    return new ChatbotError(
      "bad_request:api",
      "Invalid timestamp."
    ).toResponse();
  }

  const documentsDeleted = await withTenantForUser(session.user, async () =>
    deleteDocumentsByIdAfterTimestamp({
      id,
      timestamp: parsedTimestamp,
      userId,
    })
  );

  return Response.json(documentsDeleted, { status: 200 });
}
