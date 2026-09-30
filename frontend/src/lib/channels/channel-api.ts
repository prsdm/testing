export function channelApiUrl(tenantSlug: string, channelId: string) {
  return `${process.env.KIMIRO_BASE_PATH ?? ""}/api/channels/${tenantSlug}/${channelId}`;
}

export function channelMembersApiUrl(tenantSlug: string, channelId: string) {
  return `${channelApiUrl(tenantSlug, channelId)}/members`;
}

export async function readChannelApiError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // ignore
  }
  return fallback;
}
