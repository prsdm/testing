import {
  getTenantSlackIntegrationSettingsByTeamId,
  getTenantSlackIntegrationSigningSecret,
} from "@/core/lib/db/slack-integration-queries";
import { runInBackground } from "@/core/lib/runtime/background";
import {
  handleSlackIntegrationEvent,
  parseSlackEventEnvelope,
} from "@/core/lib/slack-integration/events";
import { verifySlackRequestSignature } from "@/core/lib/slack-integration/verify-request";

export const maxDuration = 300;

export async function POST(request: Request) {
  const rawBody = await request.text();
  const envelope = parseSlackEventEnvelope(rawBody);

  if (envelope?.type === "url_verification") {
    return Response.json({ challenge: envelope.challenge ?? "" });
  }

  const teamId = envelope?.team_id?.trim();
  if (!teamId) {
    return new Response("Missing team_id", { status: 400 });
  }

  const settings = await getTenantSlackIntegrationSettingsByTeamId(teamId);
  if (!settings) {
    return new Response("Unknown Slack workspace", { status: 404 });
  }

  const signingSecret = await getTenantSlackIntegrationSigningSecret(
    settings.tenantId
  );
  if (!signingSecret) {
    return new Response("Slack integration signing secret not configured", {
      status: 503,
    });
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

  if (envelope) {
    runInBackground(async () => {
      await handleSlackIntegrationEvent({ envelope, settings });
    });
  }

  return new Response("", { status: 200 });
}
