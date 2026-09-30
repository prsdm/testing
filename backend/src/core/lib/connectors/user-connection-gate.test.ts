import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConnectionGateAssistantText,
  resolveUserConnectionGate,
} from "./user-connection-gate";

describe("resolveUserConnectionGate", () => {
  it("proceeds when the user already connected the asked app", () => {
    const gate = resolveUserConnectionGate({
      connectedProviderIds: new Set(["jira"]),
      latentIntegrations: [],
      text: "what jira tickets i have",
    });
    assert.equal(gate.kind, "proceed");
  });

  it("blocks and returns Connect CTA when user connection is missing", () => {
    const gate = resolveUserConnectionGate({
      connectedProviderIds: new Set(),
      latentIntegrations: [
        {
          connectLabel: "Connect Jira",
          connectUrl: "/api/connectors/oauth/jira?tenantSlug=acme",
          displayName: "Jira",
          integrationKey: "jira",
          providerId: "jira",
        },
      ],
      text: "what jira tickets i have",
    });
    assert.equal(gate.kind, "needs_connection");
    if (gate.kind !== "needs_connection") {
      return;
    }
    assert.equal(gate.ctas[0]?.connectLabel, "Connect Jira");
    assert.equal(gate.ctas[0]?.toolName, "jiraSearchIssues");
  });

  it("still blocks without LLM when connect OAuth is not ready yet", () => {
    const gate = resolveUserConnectionGate({
      connectedProviderIds: new Set(),
      latentIntegrations: [],
      text: "search my slack",
    });
    assert.equal(gate.kind, "needs_connection");
    if (gate.kind !== "needs_connection") {
      return;
    }
    assert.equal(gate.ctas[0]?.connectLabel, "Open Connectors");
  });
});

describe("buildConnectionGateAssistantText", () => {
  it("asks to connect when oauth connect is available", () => {
    assert.equal(
      buildConnectionGateAssistantText([
        {
          connectLabel: "Connect Jira",
          connectUrl: "/api/connectors/oauth/jira",
          displayName: "Jira",
          integrationKey: "jira",
          toolName: "jiraSearchIssues",
        },
      ]),
      "Connect Jira to continue."
    );
  });
});
