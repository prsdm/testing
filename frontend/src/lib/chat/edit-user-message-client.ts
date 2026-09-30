import type { ChatMessage } from "@/shared/types";

export async function editUserMessage(args: {
  id: string;
  parts: ChatMessage["parts"];
  metadata?: ChatMessage["metadata"];
}) {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  const response = await fetch(`${basePath}/api/messages`, {
    body: JSON.stringify(args),
    credentials: "include",
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      body?.error ?? `Failed to edit message (${response.status})`
    );
  }
}
