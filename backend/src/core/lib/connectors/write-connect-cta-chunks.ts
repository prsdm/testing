/** Static assistant text for the user-connection gate (no tool / activity parts). */
export function buildStaticAssistantTextChunks(args: {
  textId: string;
  text: string;
}) {
  return [
    { type: "start" as const },
    { id: args.textId, type: "text-start" as const },
    { delta: args.text, id: args.textId, type: "text-delta" as const },
    { id: args.textId, type: "text-end" as const },
    { type: "finish-step" as const },
    { finishReason: "stop" as const, type: "finish" as const },
  ];
}
