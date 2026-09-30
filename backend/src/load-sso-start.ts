import * as ssoModule from "@/core/lib/auth/sso-start";

export async function handleSsoStartRequest(
  request: globalThis.Request
): Promise<globalThis.Response> {
  const mod = ssoModule as {
    handleSsoStartRequest?: (
      request: globalThis.Request
    ) => Promise<globalThis.Response>;
    default?: {
      handleSsoStartRequest?: (
        request: globalThis.Request
      ) => Promise<globalThis.Response>;
    };
  };

  const handler =
    mod.handleSsoStartRequest ?? mod.default?.handleSsoStartRequest;

  if (!handler) {
    throw new Error("handleSsoStartRequest export missing");
  }

  return handler(request);
}
