import type { OutgoingCookieOptions } from "./request-context";

export class ApiResponse extends Response {
  static json(body: unknown, init?: ResponseInit): ApiResponse {
    const headers = new Headers(init?.headers);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    return new ApiResponse(JSON.stringify(body), {
      ...init,
      headers,
    });
  }

  cookies = {
    set: (name: string, value: string, options?: OutgoingCookieOptions) => {
      const segments = [`${name}=${encodeURIComponent(value)}`];
      if (options?.path) {
        segments.push(`Path=${options.path}`);
      }
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
        segments.push(`SameSite=${options.sameSite}`);
      }
      this.headers.append("set-cookie", segments.join("; "));
    },
  };
}
