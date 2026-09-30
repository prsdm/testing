export type KnowledgeBaseListEntry = {
  id: string;
  name: string;
  description?: string | null;
};

export type KnowledgeBaseSearchResolution =
  | { kind: "resolved"; knowledgeBase: KnowledgeBaseListEntry }
  | { kind: "missing"; message: string }
  | {
      kind: "ambiguous";
      knowledgeBases: KnowledgeBaseListEntry[];
      message: string;
    }
  | { kind: "not_found"; message: string };

const KNOWLEDGE_BASE_INTENT_STOP_WORDS = new Set([
  "about",
  "any",
  "are",
  "can",
  "does",
  "find",
  "for",
  "have",
  "help",
  "how",
  "in",
  "is",
  "kimiro",
  "list",
  "me",
  "my",
  "our",
  "project",
  "knowledge",
  "base",
  "related",
  "search",
  "show",
  "tell",
  "that",
  "the",
  "this",
  "to",
  "we",
  "what",
  "which",
  "with",
  "you",
  "your",
]);

function normalizeKnowledgeBaseName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function contentTokens(message: string) {
  return normalizeKnowledgeBaseName(message)
    .split(/\s+/)
    .filter(
      (token) =>
        token.length >= 3 && !KNOWLEDGE_BASE_INTENT_STOP_WORDS.has(token)
    );
}

function scoreKnowledgeBaseMessageMatch(
  knowledgeBase: KnowledgeBaseListEntry,
  message: string
): number {
  const normalizedMessage = normalizeKnowledgeBaseName(message);
  if (!normalizedMessage) {
    return 0;
  }

  const name = normalizeKnowledgeBaseName(knowledgeBase.name);
  const description = normalizeKnowledgeBaseName(
    knowledgeBase.description ?? ""
  );
  const corpus = `${name} ${description}`.trim();
  if (!corpus) {
    return 0;
  }

  let score = 0;
  if (name.length > 0 && normalizedMessage.includes(name)) {
    score += 10 + name.length;
  }

  for (const token of contentTokens(message)) {
    if (corpus.includes(token)) {
      score += token.length >= 5 ? 3 : 1;
    }
  }

  return score;
}

export function rankKnowledgeBasesByMessageIntent(args: {
  knowledgeBases: KnowledgeBaseListEntry[];
  message: string;
}) {
  return args.knowledgeBases
    .map((knowledgeBase) => ({
      knowledgeBase,
      score: scoreKnowledgeBaseMessageMatch(knowledgeBase, args.message),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
}

/** Infer one knowledge base from the user's message using names and descriptions. */
export function resolveUniqueKnowledgeBaseHintFromMessage(args: {
  knowledgeBases: KnowledgeBaseListEntry[];
  message: string;
}): KnowledgeBaseListEntry | null {
  const ranked = rankKnowledgeBasesByMessageIntent(args);
  if (ranked.length === 0) {
    return null;
  }

  const top = ranked[0];
  const second = ranked[1];
  if (!top) {
    return null;
  }
  if (!second || top.score > second.score) {
    return top.knowledgeBase;
  }

  return null;
}

/** Case-insensitive exact name matches for disambiguation. */
export function matchKnowledgeBasesByName(args: {
  knowledgeBases: KnowledgeBaseListEntry[];
  name: string;
}): KnowledgeBaseListEntry[] {
  const needle = normalizeKnowledgeBaseName(args.name);
  if (!needle) {
    return [];
  }
  return args.knowledgeBases.filter(
    (entry) => normalizeKnowledgeBaseName(entry.name) === needle
  );
}

export function formatKnowledgeBaseListForLlm(
  knowledgeBases: KnowledgeBaseListEntry[]
) {
  if (knowledgeBases.length === 0) {
    return "No knowledge bases are available for this user.";
  }
  return knowledgeBases
    .map((entry) => {
      const description = entry.description?.trim();
      return description
        ? `- ${entry.name} (id: ${entry.id}) — ${description}`
        : `- ${entry.name} (id: ${entry.id})`;
    })
    .join("\n");
}

export function resolveKnowledgeBaseForSearch(args: {
  knowledgeBases: KnowledgeBaseListEntry[];
  knowledgeBaseId?: string | null;
  knowledgeBaseName?: string | null;
  composerKnowledgeBaseId?: string | null;
  messageHint?: string | null;
}): KnowledgeBaseSearchResolution {
  const knowledgeBaseId =
    args.knowledgeBaseId?.trim() ||
    args.composerKnowledgeBaseId?.trim() ||
    null;
  const knowledgeBaseName = args.knowledgeBaseName?.trim() || null;

  if (knowledgeBaseId) {
    const match = args.knowledgeBases.find(
      (entry) => entry.id === knowledgeBaseId
    );
    if (match) {
      return { kind: "resolved", knowledgeBase: match };
    }
    return {
      kind: "not_found",
      message: "Knowledge base not found or not accessible.",
    };
  }

  if (knowledgeBaseName) {
    const matches = matchKnowledgeBasesByName({
      knowledgeBases: args.knowledgeBases,
      name: knowledgeBaseName,
    });
    if (matches.length === 1) {
      const match = matches[0];
      if (match) {
        return { kind: "resolved", knowledgeBase: match };
      }
    }
    if (matches.length > 1) {
      return {
        kind: "ambiguous",
        knowledgeBases: matches,
        message: `Multiple knowledge bases match "${knowledgeBaseName}": ${matches.map((entry) => entry.name).join(", ")}.`,
      };
    }
    return {
      kind: "not_found",
      message: `No knowledge base named "${knowledgeBaseName}". Call listKnowledgeBases for available knowledge bases.`,
    };
  }

  const messageHint = args.messageHint?.trim();
  if (messageHint) {
    const ranked = rankKnowledgeBasesByMessageIntent({
      knowledgeBases: args.knowledgeBases,
      message: messageHint,
    });
    if (ranked.length === 1) {
      const match = ranked[0];
      if (match) {
        return { kind: "resolved", knowledgeBase: match.knowledgeBase };
      }
    }
    if (ranked.length > 1) {
      const top = ranked[0];
      const second = ranked[1];
      if (top && second && top.score > second.score) {
        return { kind: "resolved", knowledgeBase: top.knowledgeBase };
      }
      return {
        kind: "ambiguous",
        knowledgeBases: ranked.map((entry) => entry.knowledgeBase),
        message: `Multiple knowledge bases match this request: ${ranked
          .slice(0, 3)
          .map((entry) => entry.knowledgeBase.name)
          .join(", ")}. Pass knowledgeBaseName or knowledgeBaseId.`,
      };
    }
  }

  return {
    kind: "missing",
    message:
      "Pass knowledgeBaseName or knowledgeBaseId for knowledgeBaseSearch, or call listKnowledgeBases first.",
  };
}
