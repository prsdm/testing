import { auth } from "@/core/lib/auth/server-session";
import {
  getChatsByUserId,
  getTenantAccessContextByEmail,
  isTenantMemberAccessAllowed,
  searchChatsByUserId,
  toTenantUserId,
  withTenantForUser,
} from "@/core/lib/db/queries";
import { evaluateTenantAccess } from "@/core/lib/tenant/access-gate";
import { resolveTenantForUser } from "@/core/lib/tenant/resolve-tenant-for-user";
import { ChatbotError } from "@/shared/errors";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const limit = Math.min(
    Math.max(Number.parseInt(searchParams.get("limit") || "10", 10), 1),
    50
  );
  const startingAfter = searchParams.get("starting_after");
  const endingBefore = searchParams.get("ending_before");

  if (startingAfter && endingBefore) {
    return new ChatbotError(
      "bad_request:api",
      "Only one of starting_after or ending_before can be provided."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  if (!session.user.email) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const tenant = await resolveTenantForUser({
    authUserId: session.user.id,
    email: session.user.email,
    preferredTenantSlug: searchParams.get("workspace"),
  });
  if (!tenant) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const [memberAllowed, accessContext] = await Promise.all([
    isTenantMemberAccessAllowed({
      authUserId: session.user.id,
      tenantId: tenant.id,
    }),
    getTenantAccessContextByEmail(session.user.email),
  ]);
  const denial = evaluateTenantAccess({
    allowedOrgUnits: accessContext?.allowedOrgUnits ?? [],
    memberAllowed,
    personOrgUnit: accessContext?.personOrgUnit ?? null,
    personStatus: accessContext?.personStatus,
  });
  if (denial) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const tenantUserId = toTenantUserId(session.user.id);
  const titleQuery = searchParams.get("q")?.trim() ?? "";

  const chats = await withTenantForUser(session.user, () => {
    if (titleQuery) {
      return searchChatsByUserId({
        id: tenantUserId,
        limit,
        query: titleQuery,
      });
    }
    return getChatsByUserId({
      endingBefore,
      id: tenantUserId,
      limit,
      startingAfter,
    });
  });

  return Response.json(chats, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
