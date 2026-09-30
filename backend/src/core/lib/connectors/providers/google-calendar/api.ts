const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export async function googleCalendarFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}${path}`, {
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
      `Google Calendar API request failed (${response.status}): ${text.slice(0, 300)}`
    );
  }
  if (response.status === 204) {
    return {} as T;
  }
  return response.json() as Promise<T>;
}
