import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatKnowledgeBaseListForLlm,
  matchKnowledgeBasesByName,
  rankKnowledgeBasesByMessageIntent,
  resolveKnowledgeBaseForSearch,
  resolveUniqueKnowledgeBaseHintFromMessage,
} from "@/core/lib/ai/tools/knowledge-base-scope";

describe("matchKnowledgeBasesByName", () => {
  const knowledgeBases = [
    { id: "1", name: "Test KB" },
    { id: "2", name: "Test KB 2" },
    { id: "3", name: "Marketing Q1" },
  ];

  it("matches exact names case-insensitively", () => {
    assert.deepEqual(
      matchKnowledgeBasesByName({ knowledgeBases, name: "test kb" }),
      [{ id: "1", name: "Test KB" }]
    );
  });

  it("returns empty when no exact match", () => {
    assert.deepEqual(
      matchKnowledgeBasesByName({ knowledgeBases, name: "test" }),
      []
    );
  });
});

describe("resolveKnowledgeBaseForSearch", () => {
  const knowledgeBases = [
    { id: "1", name: "Test KB" },
    { id: "2", name: "Marketing Q1" },
  ];

  it("resolves by knowledgeBaseId", () => {
    assert.deepEqual(
      resolveKnowledgeBaseForSearch({ knowledgeBaseId: "2", knowledgeBases }),
      {
        kind: "resolved",
        knowledgeBase: { id: "2", name: "Marketing Q1" },
      }
    );
  });

  it("resolves by knowledgeBaseName", () => {
    assert.deepEqual(
      resolveKnowledgeBaseForSearch({
        knowledgeBaseName: "test kb",
        knowledgeBases,
      }),
      { kind: "resolved", knowledgeBase: { id: "1", name: "Test KB" } }
    );
  });

  it("uses composerKnowledgeBaseId as a per-message fallback", () => {
    assert.deepEqual(
      resolveKnowledgeBaseForSearch({
        composerKnowledgeBaseId: "2",
        knowledgeBases,
      }),
      { kind: "resolved", knowledgeBase: { id: "2", name: "Marketing Q1" } }
    );
  });

  it("requires a knowledge base when none is provided", () => {
    assert.equal(
      resolveKnowledgeBaseForSearch({ knowledgeBases }).kind,
      "missing"
    );
  });
});

describe("resolveUniqueKnowledgeBaseHintFromMessage", () => {
  const knowledgeBases = [
    {
      description: "Company hiring purpose and interview docs",
      id: "1",
      name: "test",
    },
    {
      description: "General HR policies and benefits",
      id: "2",
      name: "hr team",
    },
  ];

  it("matches a knowledge base from description keywords in the user message", () => {
    assert.deepEqual(
      resolveUniqueKnowledgeBaseHintFromMessage({
        knowledgeBases,
        message: "what we have related to hiring",
      }),
      knowledgeBases[0]
    );
  });

  it("returns null when multiple knowledge bases tie on intent", () => {
    assert.equal(
      resolveUniqueKnowledgeBaseHintFromMessage({
        knowledgeBases: [
          {
            description: "hiring and recruiting docs",
            id: "1",
            name: "alpha",
          },
          {
            description: "hiring pipeline templates",
            id: "2",
            name: "beta",
          },
        ],
        message: "show hiring knowledge bases",
      }),
      null
    );
  });
});

describe("formatKnowledgeBaseListForLlm", () => {
  it("includes description when present", () => {
    assert.match(
      formatKnowledgeBaseListForLlm([
        {
          description: "HR onboarding docs and policies",
          id: "1",
          name: "Test KB",
        },
      ]),
      /HR onboarding docs and policies/
    );
  });
});

describe("rankKnowledgeBasesByMessageIntent", () => {
  it("ranks the strongest description match first", () => {
    const ranked = rankKnowledgeBasesByMessageIntent({
      knowledgeBases: [
        { description: "hiring purpose", id: "1", name: "test" },
        { description: "budget reports", id: "2", name: "finance" },
      ],
      message: "what is in the hiring knowledge base",
    });
    assert.equal(ranked[0]?.knowledgeBase.id, "1");
  });
});
