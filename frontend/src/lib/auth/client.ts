"use client";

import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

function authClientBaseUrl() {
  if (typeof window === "undefined") {
    return;
  }
  return window.location.origin;
}

export const authClient = createAuthClient({
  baseURL: authClientBaseUrl(),
  fetchOptions: {
    credentials: "include",
  },
  plugins: [magicLinkClient()],
});
