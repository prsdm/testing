type PaginatedPayload = {
  nextPageToken?: string;
};

export async function paginateAdminDirectory<T>(input: {
  buildUrl: (pageToken?: string) => string;
  accessToken: string;
  listKey: string;
  continueOn403404?: boolean;
}): Promise<T[]> {
  const collected: T[] = [];
  let pageToken: string | undefined;

  do {
    const response = await fetch(input.buildUrl(pageToken), {
      headers: { Authorization: `Bearer ${input.accessToken}` },
    });
    if (
      input.continueOn403404 &&
      (response.status === 403 || response.status === 404)
    ) {
      return collected;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Google Admin API failed (${response.status}): ${body.slice(0, 300)}`
      );
    }
    const payload = (await response.json()) as PaginatedPayload &
      Record<string, unknown>;
    const pageItems = payload[input.listKey];
    if (Array.isArray(pageItems)) {
      collected.push(...(pageItems as T[]));
    }
    pageToken =
      typeof payload.nextPageToken === "string"
        ? payload.nextPageToken
        : undefined;
  } while (pageToken);

  return collected;
}

export async function paginateDriveApi<T>(input: {
  buildPath: (pageToken?: string) => string;
  accessToken: string;
  listKey: string;
  continueOn403404?: boolean;
}): Promise<T[]> {
  const collected: T[] = [];
  let pageToken: string | undefined;

  do {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3${input.buildPath(pageToken)}`,
      {
        headers: { Authorization: `Bearer ${input.accessToken}` },
      }
    );
    if (
      input.continueOn403404 &&
      (response.status === 403 || response.status === 404)
    ) {
      return collected;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Google Drive API failed (${response.status}): ${body.slice(0, 300)}`
      );
    }
    const payload = (await response.json()) as PaginatedPayload &
      Record<string, unknown>;
    const pageItems = payload[input.listKey];
    if (Array.isArray(pageItems)) {
      collected.push(...(pageItems as T[]));
    }
    pageToken =
      typeof payload.nextPageToken === "string"
        ? payload.nextPageToken
        : undefined;
  } while (pageToken);

  return collected;
}
