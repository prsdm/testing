export async function markChatRead(chatId: string): Promise<void> {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  const response = await fetch(`${basePath}/api/chat/${chatId}/read`, {
    method: "POST",
  });
  if (!response.ok) {
  }
}
