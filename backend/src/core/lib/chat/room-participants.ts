import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import {
  authUser,
  chatParticipants,
  tenantMembers,
} from "@/core/lib/db/tables";

const db = getDb();

export type RoomParticipantSummary = {
  userId: string;
  displayName: string;
  email: string;
};

function resolveDisplayName(args: {
  userName: string | null;
  email: string;
}): string {
  const trimmed = args.userName?.trim();
  return trimmed || args.email;
}

/** Active members of a channel, DM, or group DM (for @Kimiro room context). */
export async function listRoomParticipantsForKimiro(args: {
  chatId: string;
  tenantId: string;
}): Promise<RoomParticipantSummary[]> {
  const rows = await db
    .select({
      email: tenantMembers.email,
      userId: chatParticipants.userId,
      userName: authUser.name,
    })
    .from(chatParticipants)
    .innerJoin(authUser, eq(chatParticipants.userId, authUser.id))
    .innerJoin(
      tenantMembers,
      and(
        eq(tenantMembers.authUserId, chatParticipants.userId),
        eq(tenantMembers.tenantId, args.tenantId)
      )
    )
    .where(eq(chatParticipants.chatId, args.chatId))
    .orderBy(asc(tenantMembers.email));

  return rows.map((row) => ({
    displayName: resolveDisplayName({
      email: row.email,
      userName: row.userName,
    }),
    email: row.email,
    userId: row.userId,
  }));
}
