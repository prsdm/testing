const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

export async function gmailFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Gmail API request failed (${response.status}): ${text.slice(0, 300)}`
    );
  }
  if (response.status === 204) {
    return {} as T;
  }
  return response.json() as Promise<T>;
}
