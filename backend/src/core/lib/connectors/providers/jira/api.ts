export class JiraApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JiraApiError";
  }
}

export async function jiraFetch<T = unknown>(args: {
  cloudId: string;
  accessToken: string;
  path: string;
  method?: "GET" | "POST" | "PUT";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}): Promise<{ status: number; data: T | null }> {
  const params = new URLSearchParams();
  if (args.query) {
    for (const [key, value] of Object.entries(args.query)) {
      if (value !== undefined && value !== "") {
        params.set(key, String(value));
      }
    }
  }
  const query = params.toString();
  const path = args.path.startsWith("/") ? args.path : `/${args.path}`;
  const url = `https://api.atlassian.com/ex/jira/${encodeURIComponent(args.cloudId)}${path}${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    body: args.body ? JSON.stringify(args.body) : undefined,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${args.accessToken}`,
      "X-Atlassian-Token": "no-check",
      ...(args.body ? { "content-type": "application/json" } : {}),
    },
    method: args.method ?? "GET",
  });

  if (response.status === 204) {
    return { data: null, status: response.status };
  }

  const text = await response.text().catch(() => "");
  let data: T | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data &&
      "errorMessages" in data &&
      Array.isArray((data as { errorMessages?: string[] }).errorMessages)
        ? ((data as { errorMessages?: string[] }).errorMessages ?? []).join(
            "; "
          )
        : text.slice(0, 300) || `Jira API failed (${response.status})`;
    throw new JiraApiError(message);
  }

  return { data, status: response.status };
}
