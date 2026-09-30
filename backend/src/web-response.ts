import { Readable } from "node:stream";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import { getAppRequestContext } from "./load-request-context";

export async function sendWebResponse(
  res: ExpressResponse,
  webResponse: globalThis.Response
): Promise<void> {
  res.status(webResponse.status);
  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      for (const cookie of splitSetCookieHeader(value)) {
        res.appendHeader("set-cookie", cookie);
      }
      return;
    }
    res.setHeader(key, value);
  });

  const ctx = getAppRequestContext();
  if (ctx?.outgoingCookies.length) {
    for (const cookie of ctx.outgoingCookies) {
      res.appendHeader("set-cookie", cookie);
    }
  }

  if (!webResponse.body) {
    res.end();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    Readable.fromWeb(webResponse.body as Parameters<typeof Readable.fromWeb>[0])
      .pipe(res)
      .on("finish", () => resolve())
      .on("error", reject);
  });
}

function splitSetCookieHeader(value: string): string[] {
  return value.split(/,(?=\s*[^;]+=[^;]+)/);
}

export function expressRequestToWebRequest(
  req: ExpressRequest
): globalThis.Request {
  const protocol = req.protocol;
  const host = req.get("host") ?? "localhost";
  const url = `${protocol}://${host}${req.originalUrl}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const part of value) {
        headers.append(key, part);
      }
    } else {
      headers.set(key, value);
    }
  }

  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return new Request(url, { headers, method });
  }

  return new Request(url, {
    body: req,
    duplex: "half",
    headers,
    method,
  } as unknown as RequestInit);
}
