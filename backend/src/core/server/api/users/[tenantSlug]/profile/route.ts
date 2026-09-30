import { z } from "zod";
import { invalidateAuthSessionCache } from "@/core/lib/auth/server-session";
import {
  getUserProfileForMember,
  updateUserProfile,
} from "@/core/lib/db/user-profile-queries";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";
import { ChatbotError } from "@/shared/errors";

const patchProfileSchema = z
  .object({
    completeProfileOnboarding: z.boolean().optional(),
    department: z.string().max(255).nullable().optional(),
    jobTitle: z.string().max(255).nullable().optional(),
    name: z.string().min(1).max(255).optional(),
    preferredName: z.string().max(255).nullable().optional(),
  })
  .superRefine((body, context) => {
    if (!body.completeProfileOnboarding) {
      return;
    }

    if (!body.name?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Name is required.",
        path: ["name"],
      });
    }

    if (!body.jobTitle?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Role is required.",
        path: ["jobTitle"],
      });
    }

    if (!body.department?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Department is required.",
        path: ["department"],
      });
    }

    if (!body.preferredName?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Display name is required.",
        path: ["preferredName"],
      });
    }
  });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const profile = await getUserProfileForMember({
    authUserId: authResult.userId,
    tenantId: authResult.tenant.id,
  });

  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  return Response.json({ profile });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof patchProfileSchema>;
  try {
    body = patchProfileSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const profile = await updateUserProfile({
      authUserId: authResult.userId,
      tenantId: authResult.tenant.id,
      ...(body.completeProfileOnboarding === undefined
        ? {}
        : { completeProfileOnboarding: body.completeProfileOnboarding }),
      ...(body.department === undefined ? {} : { department: body.department }),
      ...(body.jobTitle === undefined ? {} : { jobTitle: body.jobTitle }),
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.preferredName === undefined
        ? {}
        : { preferredName: body.preferredName }),
    });

    if (!profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    await invalidateAuthSessionCache(request.headers);

    return Response.json({ profile });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return Response.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    throw error;
  }
}
