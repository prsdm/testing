export function canAccessChatWorkflowRun(
  mapping:
    | {
        chatId: string;
        authUserId: string;
      }
    | null
    | undefined,
  expected: {
    chatId: string;
    authUserId: string;
  }
): boolean {
  return (
    mapping?.chatId === expected.chatId &&
    mapping.authUserId === expected.authUserId
  );
}
