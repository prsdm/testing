"use server";

import { auth } from "@/core/lib/auth/server-session";
import { assertChatApiAccess } from "@/core/lib/chat/assert-chat-api-access";
import {
  getSuggestionsByDocumentId,
  toTenantUserId,
  withTenantForUser,
} from "@/core/lib/db/queries";

export async function getSuggestions({ documentId }: { documentId: string }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return [];
  }
  if (
    (await assertChatApiAccess({
      userEmail: session.user.email,
      userId: session.user.id,
    })) === "forbidden"
  ) {
    return [];
  }

  const userId = toTenantUserId(session.user.id);
  const suggestions = await withTenantForUser(session.user, async () =>
    getSuggestionsByDocumentId({ documentId, userId })
  );
  return suggestions ?? [];
}
