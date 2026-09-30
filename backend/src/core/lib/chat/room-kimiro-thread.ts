/** Slack-style room @Kimiro: root stays on main timeline; Kimiro lives in the thread. */
export function resolveRoomKimiroThreadScope(args: {
  clientThreadRootMessageId: string | null;
  invokesKimiro: boolean;
  userMessageId: string;
}): {
  assistantThreadRootMessageId: string | null;
  historyThreadRootMessageId: string | undefined;
  userThreadRootMessageId: string | null;
} {
  if (args.clientThreadRootMessageId) {
    return {
      assistantThreadRootMessageId: args.clientThreadRootMessageId,
      historyThreadRootMessageId: args.clientThreadRootMessageId,
      userThreadRootMessageId: args.clientThreadRootMessageId,
    };
  }

  if (args.invokesKimiro) {
    return {
      assistantThreadRootMessageId: args.userMessageId,
      historyThreadRootMessageId: args.userMessageId,
      userThreadRootMessageId: null,
    };
  }

  return {
    assistantThreadRootMessageId: null,
    historyThreadRootMessageId: undefined,
    userThreadRootMessageId: null,
  };
}
