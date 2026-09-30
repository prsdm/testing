export function chatModelsApiUrl(tenantSlug: string) {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  return `${basePath}/api/workspace/${encodeURIComponent(tenantSlug)}/models`;
}

/** @deprecated Use {@link chatModelsApiUrl} with an explicit tenant slug. */
export const CHAT_MODELS_API_URL = `${process.env.KIMIRO_BASE_PATH ?? ""}/api/models`;

export async function fetchChatModels(tenantSlug: string) {
  const response = await fetch(chatModelsApiUrl(tenantSlug), {
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`Failed to load models (${response.status})`);
  }
  return response.json();
}
