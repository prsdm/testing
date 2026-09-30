import { auth } from "@/core/lib/auth/server-session";
import { getFreeTrialStatusForUser } from "@/core/lib/billing/free-trial-status";
import { assertChatApiAccess } from "@/core/lib/chat/assert-chat-api-access";
import { getTenantAccessContextByEmail } from "@/core/lib/db/queries";

const inactive = { active: false as const };

export async function GET() {
  const session = await auth();
  const headers = {
    "Cache-Control": "private, no-store",
  };

  const email = session?.user?.email;
  const userId = session?.user?.id;
  if (!(email && userId)) {
    return Response.json(inactive, { headers });
  }

  if (
    (await assertChatApiAccess({
      userEmail: email,
      userId,
    })) === "forbidden"
  ) {
    return Response.json(inactive, { headers, status: 403 });
  }

  const accessContext = await getTenantAccessContextByEmail(email);
  if (!accessContext?.tenantId) {
    return Response.json(inactive, { headers });
  }

  const status = await getFreeTrialStatusForUser({
    authUserId: userId,
    tenantId: accessContext.tenantId,
  });

  return Response.json(status, { headers });
}
