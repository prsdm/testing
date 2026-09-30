import { getVespaUrl } from "./config";

type VespaRequestInit = RequestInit & {
  timeoutMs?: number;
};

export async function vespaFetch(path: string, init: VespaRequestInit = {}) {
  const { timeoutMs = 120_000, ...requestInit } = init;
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${getVespaUrl()}${path}`, {
      ...requestInit,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export async function vespaJson<T>(
  path: string,
  init: VespaRequestInit = {}
): Promise<T> {
  const response = await vespaFetch(path, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Vespa request failed (${response.status}) ${path}: ${text.slice(0, 500)}`
    );
  }
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}
