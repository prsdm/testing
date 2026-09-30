import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { sendAuthEmail } from "@/core/lib/auth/send-auth-email";
import { ChatbotError } from "@/shared/errors";
import type { TenantMemberRole } from "@/shared/users/tenant-member-role";
import { generateUUID } from "@/shared/utils";
import { getDb } from "./client";
import {
  type TenantInvite,
  tenantInvites,
  tenantMembers,
  tenants,
} from "./tables";

const db = getDb();
const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 14;

function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function appBaseUrl() {
  return (
    process.env.KIMIRO_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://localhost:5173"
  );
}

export async function listPendingTenantInvites(tenantId: string) {
  try {
    return await db
      .select({
        createdAt: tenantInvites.createdAt,
        email: tenantInvites.email,
        expiresAt: tenantInvites.expiresAt,
        id: tenantInvites.id,
        invitedByAuthUserId: tenantInvites.invitedByAuthUserId,
        role: tenantInvites.role,
      })
      .from(tenantInvites)
      .where(
        and(
          eq(tenantInvites.tenantId, tenantId),
          isNull(tenantInvites.acceptedAt),
          isNull(tenantInvites.revokedAt),
          gt(tenantInvites.expiresAt, new Date())
        )
      )
      .orderBy(asc(tenantInvites.createdAt));
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to list tenant invites"
    );
  }
}

export async function createTenantInvite({
  tenantId,
  tenantSlug,
  companyName,
  email,
  role,
  invitedByAuthUserId,
}: {
  tenantId: string;
  tenantSlug: string;
  companyName: string;
  email: string;
  role: TenantMemberRole;
  invitedByAuthUserId: string;
}): Promise<{ invite: TenantInvite; inviteUrl: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) {
    throw new ChatbotError("bad_request:api", "Enter a valid email address.");
  }

  try {
    const [existingMember] = await db
      .select({ id: tenantMembers.id })
      .from(tenantMembers)
      .where(
        and(
          eq(tenantMembers.tenantId, tenantId),
          eq(tenantMembers.email, normalizedEmail)
        )
      )
      .limit(1);
    if (existingMember) {
      throw new ChatbotError(
        "bad_request:api",
        "That email is already a member of this workspace."
      );
    }

    const { assertSeatAvailableForInvite } = await import(
      "@/core/lib/billing/assert-seat-available"
    );
    await assertSeatAvailableForInvite(tenantId);

    await db
      .update(tenantInvites)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(tenantInvites.tenantId, tenantId),
          eq(tenantInvites.email, normalizedEmail),
          isNull(tenantInvites.acceptedAt),
          isNull(tenantInvites.revokedAt)
        )
      );

    const token = randomBytes(32).toString("hex");
    const tokenHash = hashInviteToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

    const [invite] = await db
      .insert(tenantInvites)
      .values({
        createdAt: now,
        email: normalizedEmail,
        expiresAt,
        id: generateUUID(),
        invitedByAuthUserId,
        role,
        tenantId,
        tokenHash,
      })
      .returning();

    const inviteUrl = `${appBaseUrl()}/login?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(normalizedEmail)}`;

    try {
      await sendAuthEmail({
        subject: `You're invited to ${companyName} on Kimiro`,
        text: [
          `You've been invited to join ${companyName} (${tenantSlug}) on Kimiro.`,
          "",
          "Sign in with this email to accept:",
          inviteUrl,
          "",
          `This invite expires on ${expiresAt.toISOString()}.`,
        ].join("\n"),
        to: normalizedEmail,
      });
    } catch (error) {
      await db
        .update(tenantInvites)
        .set({ revokedAt: new Date() })
        .where(eq(tenantInvites.id, invite.id));
      throw error instanceof Error
        ? error
        : new Error("Failed to send invite email");
    }

    return { invite, inviteUrl };
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    throw new ChatbotError(
      "bad_request:api",
      error instanceof Error ? error.message : "Failed to create invite"
    );
  }
}

export async function revokeTenantInvite({
  tenantId,
  inviteId,
}: {
  tenantId: string;
  inviteId: string;
}) {
  try {
    const [updated] = await db
      .update(tenantInvites)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(tenantInvites.id, inviteId),
          eq(tenantInvites.tenantId, tenantId),
          isNull(tenantInvites.acceptedAt),
          isNull(tenantInvites.revokedAt)
        )
      )
      .returning({ id: tenantInvites.id });
    return Boolean(updated);
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to revoke invite"
    );
  }
}

/** Accept all valid pending invites for this email; create memberships. */
export async function acceptPendingInvitesForUser({
  authUserId,
  email,
}: {
  authUserId: string;
  email: string;
}): Promise<number> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();

  try {
    const pending = await db
      .select({
        id: tenantInvites.id,
        role: tenantInvites.role,
        tenantId: tenantInvites.tenantId,
        tenantStatus: tenants.status,
      })
      .from(tenantInvites)
      .innerJoin(tenants, eq(tenantInvites.tenantId, tenants.id))
      .where(
        and(
          eq(tenantInvites.email, normalizedEmail),
          isNull(tenantInvites.acceptedAt),
          isNull(tenantInvites.revokedAt),
          gt(tenantInvites.expiresAt, now)
        )
      );

    let accepted = 0;
    for (const invite of pending) {
      if (invite.tenantStatus !== "active") {
        continue;
      }

      const [existing] = await db
        .select({ id: tenantMembers.id })
        .from(tenantMembers)
        .where(
          and(
            eq(tenantMembers.tenantId, invite.tenantId),
            eq(tenantMembers.authUserId, authUserId)
          )
        )
        .limit(1);

      if (!existing) {
        const { assertSeatAvailableForMember } = await import(
          "@/core/lib/billing/assert-seat-available"
        );
        try {
          await assertSeatAvailableForMember(invite.tenantId);
        } catch {
          // Leave invite pending until an admin buys seats or frees capacity.
          continue;
        }
        await db.insert(tenantMembers).values({
          authUserId,
          createdAt: now,
          email: normalizedEmail,
          id: generateUUID(),
          isActive: true,
          lastLoginAt: now,
          personId: null,
          role: invite.role,
          tenantId: invite.tenantId,
          updatedAt: now,
        });
      }

      await db
        .update(tenantInvites)
        .set({ acceptedAt: now })
        .where(eq(tenantInvites.id, invite.id));
      accepted += 1;
    }

    return accepted;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to accept pending invites"
    );
  }
}
