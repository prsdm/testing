import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getBlockedToolIdsForLatentIntegrations } from "./latent-tool-substitution";
import { oauthConnectPathForIntegration } from "./oauth-connect-url";

describe("latent connector integration", () => {
  it("returns no blocked tools when substitution map is empty", () => {
    const blocked = getBlockedToolIdsForLatentIntegrations(["gmail"]);
    assert.deepEqual([...blocked], []);
  });

  it("builds oauth connect paths for google and slack integrations", () => {
    const drivePath = oauthConnectPathForIntegration("acme", {
      credentialFamily: "google",
      description: "Google Drive",
      googleAppId: "google-drive",
      key: "google-drive",
      name: "Google Drive",
      provider: "google-drive",
      requiresSiteUrl: false,
    });
    assert.match(drivePath, /app=google-drive/);

    const slackPath = oauthConnectPathForIntegration("acme", {
      credentialFamily: "slack",
      description: "Slack",
      key: "slack",
      name: "Slack",
      provider: "slack",
      requiresSiteUrl: false,
    });
    assert.match(slackPath, /\/api\/connectors\/oauth\/slack/);
    assert.match(slackPath, /tenantSlug=acme/);
  });
});
