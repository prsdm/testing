import { KNOWLEDGE_BASE_SEARCH_TOOL_INPUT_FLAG } from "@/shared/knowledge-bases/knowledge-base-search-scope";
import type { InternalSearchToolOutput } from "@/shared/search/citations";
import type { ChatMessage } from "@/shared/types";

export {
  isKnowledgeBaseScopeSourceSearchInput,
  KNOWLEDGE_BASE_SEARCH_TOOL_INPUT_FLAG,
} from "@/shared/knowledge-bases/knowledge-base-search-scope";

type KnowledgeBaseSearchToolPart = Extract<
  ChatMessage["parts"][number],
  { type: `tool-${string}` }
> & {
  type: "tool-sourceSearch";
  input: {
    query: string;
    [KNOWLEDGE_BASE_SEARCH_TOOL_INPUT_FLAG]: boolean;
    knowledgeBaseName?: string;
  };
  output?: InternalSearchToolOutput;
};

export function buildKnowledgeBaseSearchToolPart(args: {
  toolCallId: string;
  query: string;
  knowledgeBaseName?: string;
  state: "input-available" | "output-available";
  output?: InternalSearchToolOutput;
}): KnowledgeBaseSearchToolPart {
  const input = {
    query: args.query,
    [KNOWLEDGE_BASE_SEARCH_TOOL_INPUT_FLAG]: true,
    ...(args.knowledgeBaseName
      ? { knowledgeBaseName: args.knowledgeBaseName }
      : {}),
  };

  if (args.state === "input-available") {
    return {
      input,
      state: "input-available",
      toolCallId: args.toolCallId,
      type: "tool-sourceSearch",
    };
  }

  return {
    input,
    output: args.output ?? {
      citationMap: {},
      documents: [],
      steps: [{ type: "done" }],
    },
    state: "output-available",
    toolCallId: args.toolCallId,
    type: "tool-sourceSearch",
  };
}
