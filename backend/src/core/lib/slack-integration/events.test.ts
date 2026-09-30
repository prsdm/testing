import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TenantSlackIntegrationSettings } from "@/core/lib/db/tables";
import {
  routeSlackIntegrationEvent,
  shouldHandleSlackIntegrationEvent,
} from "./event-routing";

function baseSettings(
  overrides: Partial<TenantSlackIntegrationSettings> = {}
): TenantSlackIntegrationSettings {
  return {
    allowedChannelIds: ["CALLOWED"],
    botTokenEncrypted: "encrypted-token",
    botUserId: "U123",
    credentialMode: "managed",
    deliverablesEnabled: true,
    dmsEnabled: true,
    enabled: true,
    installedAt: new Date("2026-01-01T00:00:00.000Z"),
    installedByUserId: "user-1",
    oauthClientId: null,
    oauthClientSecretEncrypted: null,
    signingSecretEncrypted: null,
    slackTeamId: "T123",
    slackTeamName: "Acme",
    tenantId: "tenant-1",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("shouldHandleSlackIntegrationEvent", () => {
  it("accepts app_mention in an allowed channel", () => {
    const result = shouldHandleSlackIntegrationEvent({
      envelope: {
        event: {
          channel: "CALLOWED",
          channel_type: "channel",
          text: "<@U123> hello",
          type: "app_mention",
          user: "U456",
        },
        team_id: "T123",
      },
      settings: baseSettings(),
    });

    assert.deepEqual(result, { handled: true, reason: "accepted" });
  });

  it("rejects channels that are not allowlisted", () => {
    const result = shouldHandleSlackIntegrationEvent({
      envelope: {
        event: {
          channel: "CBLOCKED",
          channel_type: "channel",
          type: "app_mention",
        },
        team_id: "T123",
      },
      settings: baseSettings(),
    });

    assert.deepEqual(result, {
      handled: false,
      reason: "channel_not_allowed",
    });
  });

  it("allows DMs when dmsEnabled is true", () => {
    const result = shouldHandleSlackIntegrationEvent({
      envelope: {
        event: {
          channel: "D123",
          channel_type: "im",
          type: "app_mention",
        },
        team_id: "T123",
      },
      settings: baseSettings({ allowedChannelIds: [] }),
    });

    assert.deepEqual(result, { handled: true, reason: "accepted" });
  });

  it("blocks DMs when dmsEnabled is false", () => {
    const result = shouldHandleSlackIntegrationEvent({
      envelope: {
        event: {
          channel: "D123",
          channel_type: "im",
          type: "app_mention",
        },
        team_id: "T123",
      },
      settings: baseSettings({ dmsEnabled: false }),
    });

    assert.deepEqual(result, {
      handled: false,
      reason: "channel_not_allowed",
    });
  });

  it("ignores non app_mention events", () => {
    const result = shouldHandleSlackIntegrationEvent({
      envelope: {
        event: {
          channel: "CALLOWED",
          channel_type: "channel",
          type: "message",
        },
        team_id: "T123",
      },
      settings: baseSettings(),
    });

    assert.deepEqual(result, {
      handled: false,
      reason: "ignored_event_type",
    });
  });

  it("accepts agent DM messages when dms are enabled", () => {
    const result = routeSlackIntegrationEvent({
      envelope: {
        event: {
          channel: "D123",
          channel_type: "im",
          text: "hello",
          thread_ts: "123.000",
          ts: "123.456",
          type: "message",
          user: "U456",
        },
        team_id: "T123",
      },
      settings: baseSettings(),
    });

    assert.deepEqual(result, { handled: true, kind: "agent_message" });
  });

  it("accepts assistant_thread_started events", () => {
    const result = routeSlackIntegrationEvent({
      envelope: {
        event: {
          channel: "D123",
          thread_ts: "123.000",
          type: "assistant_thread_started",
        },
        team_id: "T123",
      },
      settings: baseSettings(),
    });

    assert.deepEqual(result, {
      handled: true,
      kind: "assistant_thread_started",
    });
  });
});
