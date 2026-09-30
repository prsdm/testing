import * as authModule from "@/core/lib/auth/better-auth-instance";

export function loadAuthInstance() {
  const mod = authModule as {
    authInstance?: typeof import("@/core/lib/auth/better-auth-instance").authInstance;
    default?: {
      authInstance?: typeof import("@/core/lib/auth/better-auth-instance").authInstance;
    };
  };
  const authInstance = mod.authInstance ?? mod.default?.authInstance;

  if (!authInstance) {
    throw new Error("authInstance export missing");
  }

  return authInstance;
}
