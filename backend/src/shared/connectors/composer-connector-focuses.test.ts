import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ComposerConnectorFocus } from "@/shared/connectors/composer-connector-focus";
import {
  mergeComposerConnectorFocuses,
  resolveComposerConnectorFocusesFromText,
} from "@/shared/connectors/composer-connector-focuses";

const targets = [
  {
    handle: "document",
    focus: {
      kind: "work-skill" as const,
      name: "Document",
      skillId: "docs" as const,
    },
  },
  {
    handle: "exa",
    focus: {
      kind: "mcp" as const,
      name: "Exa",
      serverId: "exa-server",
    },
  },
];

describe("composer connector focuses", () => {
  it("resolves multiple @ mentions in order", () => {
    const text =
      "@document create doc on openai report get report first using @exa";
    const focuses = resolveComposerConnectorFocusesFromText(text, targets);
    assert.equal(focuses.length, 2);
    assert.equal(focuses[0]?.kind, "work-skill");
    assert.equal(focuses[1]?.kind, "mcp");
  });

  it("dedupes when merging lists", () => {
    const duplicate: ComposerConnectorFocus = {
      kind: "mcp",
      name: "Exa",
      serverId: "exa-server",
    };
    const merged = mergeComposerConnectorFocuses([duplicate], [duplicate]);
    assert.equal(merged.length, 1);
  });
});
