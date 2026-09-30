import { and, eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import {
  getTenantById,
  toTenantUserId,
  withTenantId,
} from "@/core/lib/db/queries";
import {
  getTenantSlackIntegrationSettingsByTeamId,
  getTenantSlackIntegrationSigningSecret,
  getTenantSlackIntegrationToken,
} from "@/core/lib/db/slack-integration-queries";
import { getSlackIntegrationThreadMapping } from "@/core/lib/db/slack-integration-thread-queries";
import { tenantMembers, tenants } from "@/core/lib/db/tables";
import {
  handleSlackIntegrationApprovalAction,
  parseSlackIntegrationApprovalActionValue,
} from "@/core/lib/slack-integration/handle-approval";
import { verifySlackRequestSignature } from "@/core/lib/slack-integration/verify-request";

const db = getDb();

type SlackInteractionPayload = {
  type?: string;
  team?: { id?: string };
  user?: { id?: string };
  actions?: Array<{
    action_id?: string;
    value?: string;
  }>;
};

export function parseSlackInteractionPayload(rawBody: string) {
  const params = new URLSearchParams(rawBody);
  const payloadRaw = params.get("payload");
  if (!payloadRaw) {
    return null;
  }
  try {
    return JSON.parse(payloadRaw) as SlackInteractionPayload;
  } catch {
    return null;
  }
}

async function resolveKimiroUserFromThread(args: {
  tenantId: string;
  channelId: string;
  threadTs: string;
}) {
  const thread = await getSlackIntegrationThreadMapping({
    slackChannelId: args.channelId,
    slackThreadTs: args.threadTs,
    tenantId: args.tenantId,
  });
  if (!thread) {
    return null;
  }

  return withTenantId(args.tenantId, async () => {
    const [member] = await db
      .select({
        authUserId: tenantMembers.authUserId,
        email: tenantMembers.email,
      })
      .from(tenantMembers)
      .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
      .where(
        and(
          eq(tenantMembers.tenantId, args.tenantId),
          eq(tenantMembers.authUserId, thread.authUserId),
          eq(tenantMembers.isActive, true)
        )
      )
      .limit(1);
    if (!member?.authUserId || !member.email) {
      return null;
    }
    return {
      authUserId: member.authUserId,
      email: member.email,
      name: null as string | null,
    };
  });
}

export async function handleSlackInteractionRequest(request: Request) {
  const rawBody = await request.text();
  const payload = parseSlackInteractionPayload(rawBody);
  const teamId = payload?.team?.id?.trim();
  if (!teamId) {
    return new Response("Missing team id", { status: 400 });
  }

  const settings = await getTenantSlackIntegrationSettingsByTeamId(teamId);
  if (!settings) {
    return new Response("Unknown Slack workspace", { status: 404 });
  }

  const signingSecret = await getTenantSlackIntegrationSigningSecret(
    settings.tenantId
  );
  if (!signingSecret) {
    return new Response("Signing secret not configured", { status: 503 });
  }

  const valid = verifySlackRequestSignature({
    rawBody,
    signature: request.headers.get("x-slack-signature"),
    signingSecret,
    timestamp: request.headers.get("x-slack-request-timestamp"),
  });
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  if (payload?.type !== "block_actions") {
    return new Response("", { status: 200 });
  }

  const action = payload.actions?.[0];
  if (!action) {
    return new Response("", { status: 200 });
  }

  const approvalPayload = parseSlackIntegrationApprovalActionValue(
    action.value
  );
  if (!approvalPayload) {
    return new Response("", { status: 200 });
  }

  const approved =
    action.action_id === "slack_integration_approve" ||
    action.action_id === "slack_bot_approve";
  const denied =
    action.action_id === "slack_integration_deny" ||
    action.action_id === "slack_bot_deny";
  if (!(approved || denied)) {
    return new Response("", { status: 200 });
  }

  const botToken = await getTenantSlackIntegrationToken(settings.tenantId);
  const tenant = await getTenantById(settings.tenantId);
  if (!(botToken && tenant?.slug)) {
    return new Response("Slack integration unavailable", { status: 503 });
  }

  const kimiroUser = await resolveKimiroUserFromThread({
    channelId: approvalPayload.channelId,
    tenantId: settings.tenantId,
    threadTs: approvalPayload.threadTs,
  });
  if (!kimiroUser) {
    return new Response("", { status: 200 });
  }

  await handleSlackIntegrationApprovalAction({
    approved,
    authUserId: kimiroUser.authUserId,
    botToken,
    deliverablesEnabled: settings.deliverablesEnabled,
    email: kimiroUser.email,
    name: kimiroUser.name,
    payload: approvalPayload,
    tenantSlug: tenant.slug,
    tenantUserId: toTenantUserId(kimiroUser.authUserId),
  });

  return new Response("", { status: 200 });
}
