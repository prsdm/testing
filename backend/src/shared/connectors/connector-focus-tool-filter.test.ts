import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  builtInToolAllowedForConnectorFocus,
  connectorToolAllowedForConnectorFocus,
  mcpToolAllowedForConnectorFocus,
} from "@/shared/connectors/connector-focus-tool-filter";

describe("connector focus tool filter", () => {
  it("allows all built-ins when focus is unset", () => {
    assert.equal(builtInToolAllowedForConnectorFocus("webSearch", null), true);
    assert.equal(
      connectorToolAllowedForConnectorFocus({ providerId: "gmail" }, null),
      true
    );
  });

  it("scopes MCP focus to one server and todoWrite", () => {
    const focus = {
      kind: "mcp" as const,
      name: "Exa",
      serverId: "server-1",
    };
    assert.equal(builtInToolAllowedForConnectorFocus("todoWrite", focus), true);
    assert.equal(
      builtInToolAllowedForConnectorFocus("webSearch", focus),
      false
    );
    assert.equal(
      mcpToolAllowedForConnectorFocus({ serverId: "server-1" }, focus),
      true
    );
    assert.equal(
      mcpToolAllowedForConnectorFocus({ serverId: "other" }, focus),
      false
    );
    assert.equal(
      connectorToolAllowedForConnectorFocus({ providerId: "gmail" }, focus),
      false
    );
  });

  it("scopes provider focus to matching connector tools", () => {
    const focus = {
      kind: "provider" as const,
      name: "Gmail",
      provider: "gmail" as const,
    };
    assert.equal(
      connectorToolAllowedForConnectorFocus({ providerId: "gmail" }, focus),
      true
    );
    assert.equal(
      connectorToolAllowedForConnectorFocus({ providerId: "slack" }, focus),
      false
    );
    assert.equal(
      builtInToolAllowedForConnectorFocus("sandboxExec", focus),
      false
    );
  });

  it("keeps sandbox toolchain for work-skill focus", () => {
    const focus = {
      kind: "work-skill" as const,
      name: "PDF",
      skillId: "pdf" as const,
    };
    assert.equal(
      builtInToolAllowedForConnectorFocus("sandboxExec", focus),
      true
    );
    assert.equal(
      builtInToolAllowedForConnectorFocus("saveToLibrary", focus),
      true
    );
    assert.equal(
      builtInToolAllowedForConnectorFocus("webSearch", focus),
      false
    );
    assert.equal(
      connectorToolAllowedForConnectorFocus({ providerId: "gmail" }, focus),
      false
    );
  });
});
