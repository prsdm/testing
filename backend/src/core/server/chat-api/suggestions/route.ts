import { auth } from "@/core/lib/auth/server-session";
import { assertChatApiAccess } from "@/core/lib/chat/assert-chat-api-access";
import {
  getSuggestionsByDocumentId,
  toTenantUserId,
  withTenantForUser,
} from "@/core/lib/db/queries";
import { ChatbotError } from "@/shared/errors";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");

  if (!documentId) {
    return new ChatbotError(
      "bad_request:api",
      "Parameter documentId is required."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:suggestions").toResponse();
  }
  if (!session.user.email) {
    return new ChatbotError("unauthorized:suggestions").toResponse();
  }
  if (
    (await assertChatApiAccess({
      userEmail: session.user.email,
      userId: session.user.id,
    })) === "forbidden"
  ) {
    return new ChatbotError("forbidden:api").toResponse();
  }

  const userId = toTenantUserId(session.user.id);
  const suggestions = await withTenantForUser(session.user, async () =>
    getSuggestionsByDocumentId({
      documentId,
      userId,
    })
  );

  return Response.json(suggestions, { status: 200 });
}
