import { AsyncLocalStorage } from "node:async_hooks";
import type { IncomingMessage } from "node:http";
import { fromNodeHeaders } from "better-auth/node";

export type OutgoingCookieOptions = {
  path?: string;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
};

export type AppRequestContext = {
  headers: Headers;
  cookieHeader: string | null;
  outgoingCookies: string[];
};

type RequestCookieStore = {
  get: (name: string) => { name: string; value: string } | undefined;
  set: (name: string, value: string, options?: OutgoingCookieOptions) => void;
  delete: (name: string) => void;
};

export const appRequestContext = new AsyncLocalStorage<AppRequestContext>();

export function getAppRequestContext(): AppRequestContext | undefined {
  return appRequestContext.getStore();
}

export function runWithIncomingMessage<T>(
  req: IncomingMessage,
  fn: () => T
): T {
  const headers = fromNodeHeaders(req.headers);
  return appRequestContext.run(
    {
      cookieHeader:
        typeof req.headers.cookie === "string" ? req.headers.cookie : null,
      headers,
      outgoingCookies: [],
    },
    fn
  );
}

function requireRequestContext(): AppRequestContext {
  const context = getAppRequestContext();
  if (!context) {
    throw new Error("Request context is unavailable outside an API request");
  }
  return context;
}

function parseCookies(cookieHeader: string | null) {
  const cookies = new Map<string, string>();
  for (const part of cookieHeader?.split(";") ?? []) {
    const [name, ...value] = part.trim().split("=");
    if (name) {
      cookies.set(name, value.join("="));
    }
  }
  return cookies;
}

function formatSetCookie(
  name: string,
  value: string,
  options?: OutgoingCookieOptions
) {
  const segments = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options?.path ?? "/"}`,
  ];
  if (options?.maxAge !== undefined) {
    segments.push(`Max-Age=${options.maxAge}`);
  }
  if (options?.httpOnly) {
    segments.push("HttpOnly");
  }
  if (options?.secure) {
    segments.push("Secure");
  }
  if (options?.sameSite) {
    segments.push(
      `SameSite=${options.sameSite.charAt(0).toUpperCase()}${options.sameSite.slice(1)}`
    );
  }
  return segments.join("; ");
}

export function requestHeaders(): Headers {
  return requireRequestContext().headers;
}

export function requestCookies(): RequestCookieStore {
  const context = requireRequestContext();
  const cookies = parseCookies(context.cookieHeader);
  return {
    delete(name) {
      context.outgoingCookies.push(
        formatSetCookie(name, "", { maxAge: 0, path: "/" })
      );
    },
    get(name) {
      const value = cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(name, value, options) {
      context.outgoingCookies.push(formatSetCookie(name, value, options));
    },
  };
}
