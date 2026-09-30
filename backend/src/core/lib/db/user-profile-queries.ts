import { and, eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { authUser, tenantMembers, tenantPeople } from "@/core/lib/db/tables";
import { ChatbotError } from "@/shared/errors";
import type { ProfileOnboardingStatus } from "@/shared/onboarding/profile-status";

export type UserProfile = {
  name: string;
  email: string;
  image: string | null;
  jobTitle: string;
  department: string;
  preferredName: string;
};

/** Member override wins when set (including cleared ''); IdP fallback only when never set (null). */
function resolveProfileField(
  memberValue: string | null,
  personValue: string | null | undefined
): string {
  if (memberValue !== null) {
    return memberValue.trim();
  }
  return personValue?.trim() || "";
}

export async function getUserProfileForMember(args: {
  tenantId: string;
  authUserId: string;
}): Promise<UserProfile | null> {
  const db = getDb();
  const [row] = await db
    .select({
      email: authUser.email,
      image: authUser.image,
      memberDepartment: tenantMembers.department,
      memberJobTitle: tenantMembers.jobTitle,
      memberPreferredName: tenantMembers.preferredName,
      name: authUser.name,
      personDepartment: tenantPeople.department,
      personTitle: tenantPeople.title,
    })
    .from(tenantMembers)
    .innerJoin(authUser, eq(tenantMembers.authUserId, authUser.id))
    .leftJoin(tenantPeople, eq(tenantMembers.personId, tenantPeople.id))
    .where(
      and(
        eq(tenantMembers.tenantId, args.tenantId),
        eq(tenantMembers.authUserId, args.authUserId)
      )
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    department: resolveProfileField(row.memberDepartment, row.personDepartment),
    email: row.email,
    image: row.image,
    jobTitle: resolveProfileField(row.memberJobTitle, row.personTitle),
    name: row.name?.trim() || "",
    preferredName: row.memberPreferredName?.trim() || "",
  };
}

export async function getMemberProfileOnboardingStatus(args: {
  tenantId: string;
  authUserId: string;
}): Promise<ProfileOnboardingStatus | null> {
  const db = getDb();
  const [row] = await db
    .select({
      memberDepartment: tenantMembers.department,
      memberJobTitle: tenantMembers.jobTitle,
      memberPreferredName: tenantMembers.preferredName,
      name: authUser.name,
      personDepartment: tenantPeople.department,
      personTitle: tenantPeople.title,
      profileOnboardingCompletedAt: tenantMembers.profileOnboardingCompletedAt,
    })
    .from(tenantMembers)
    .innerJoin(authUser, eq(tenantMembers.authUserId, authUser.id))
    .leftJoin(tenantPeople, eq(tenantMembers.personId, tenantPeople.id))
    .where(
      and(
        eq(tenantMembers.tenantId, args.tenantId),
        eq(tenantMembers.authUserId, args.authUserId)
      )
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    needsProfileSetup: row.profileOnboardingCompletedAt === null,
    profile: {
      department: resolveProfileField(
        row.memberDepartment,
        row.personDepartment
      ),
      jobTitle: resolveProfileField(row.memberJobTitle, row.personTitle),
      name: row.name?.trim() || "",
      preferredName: row.memberPreferredName?.trim() || "",
    },
  };
}

export async function updateUserProfile(args: {
  tenantId: string;
  authUserId: string;
  name?: string;
  jobTitle?: string | null;
  department?: string | null;
  preferredName?: string | null;
  completeProfileOnboarding?: boolean;
}): Promise<UserProfile | null> {
  const db = getDb();
  const [member] = await db
    .select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, args.tenantId),
        eq(tenantMembers.authUserId, args.authUserId)
      )
    )
    .limit(1);

  if (!member) {
    return null;
  }

  if (args.completeProfileOnboarding) {
    const trimmedName = args.name?.trim();
    const trimmedJobTitle = args.jobTitle?.trim();
    const trimmedDepartment = args.department?.trim();
    const trimmedPreferredName = args.preferredName?.trim();
    if (!trimmedName) {
      throw new ChatbotError("bad_request:api", "Name is required.");
    }
    if (!trimmedJobTitle) {
      throw new ChatbotError("bad_request:api", "Role is required.");
    }
    if (!trimmedDepartment) {
      throw new ChatbotError("bad_request:api", "Department is required.");
    }
    if (!trimmedPreferredName) {
      throw new ChatbotError("bad_request:api", "Display name is required.");
    }

    await db
      .update(authUser)
      .set({ name: trimmedName, updatedAt: new Date() })
      .where(eq(authUser.id, args.authUserId));

    await db
      .update(tenantMembers)
      .set({
        department: trimmedDepartment,
        jobTitle: trimmedJobTitle,
        preferredName: trimmedPreferredName,
        profileOnboardingCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenantMembers.id, member.id));

    return getUserProfileForMember(args);
  }

  const authPatch: {
    name?: string;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (args.name !== undefined) {
    const trimmed = args.name.trim();
    if (!trimmed) {
      throw new ChatbotError("bad_request:api", "Name is required.");
    }
    authPatch.name = trimmed;
  }

  if (args.name !== undefined) {
    await db
      .update(authUser)
      .set(authPatch)
      .where(eq(authUser.id, args.authUserId));
  }

  const memberPatch: {
    jobTitle?: string;
    department?: string;
    preferredName?: string;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (args.jobTitle !== undefined) {
    memberPatch.jobTitle = args.jobTitle?.trim() || "";
  }
  if (args.department !== undefined) {
    memberPatch.department = args.department?.trim() || "";
  }
  if (args.preferredName !== undefined) {
    const trimmedPreferredName = args.preferredName?.trim();
    if (!trimmedPreferredName) {
      throw new ChatbotError("bad_request:api", "Display name is required.");
    }
    memberPatch.preferredName = trimmedPreferredName;
  }

  if (
    args.jobTitle !== undefined ||
    args.department !== undefined ||
    args.preferredName !== undefined
  ) {
    await db
      .update(tenantMembers)
      .set(memberPatch)
      .where(eq(tenantMembers.id, member.id));
  }

  return getUserProfileForMember(args);
}
