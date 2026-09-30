import { isPreviewMode } from "./is-preview-mode";
import {
  PREVIEW_TENANT_SLUG,
  previewChannelDetails,
  previewChannelMembers,
  previewChannels,
  previewChatHistory,
  previewDms,
  previewMessagesForChat,
  previewModelsResponse,
  previewProfileStatus,
  previewShellContext,
  previewWorkspace,
} from "./preview-sample-data";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function resolveRequest(input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method ?? "GET").toUpperCase();
  const url =
    typeof input === "string"
      ? new URL(input, window.location.origin)
      : input instanceof URL
        ? input
        : new URL(input.url);

  return { method, pathname: url.pathname, search: url.search, url };
}

function previewResponse(
  method: string,
  pathname: string,
  search: string
): Response | null {
  if (method === "GET" && pathname === "/api/workspace/shell") {
    return jsonResponse(previewShellContext);
  }

  if (method === "GET" && pathname === "/api/workspace") {
    return jsonResponse(previewWorkspace);
  }

  if (method === "GET" && pathname === "/api/free-trial") {
    return jsonResponse({ active: false });
  }

  if (method === "GET" && pathname.startsWith("/api/history")) {
    return jsonResponse(previewChatHistory());
  }

  if (
    method === "GET" &&
    pathname === `/api/workspace/${encodeURIComponent(PREVIEW_TENANT_SLUG)}/models`
  ) {
    return jsonResponse(previewModelsResponse());
  }

  if (
    method === "GET" &&
    pathname ===
      `/api/users/${encodeURIComponent(PREVIEW_TENANT_SLUG)}/onboarding-status`
  ) {
    return jsonResponse(previewProfileStatus);
  }

  if (
    method === "GET" &&
    pathname === `/api/channels/${encodeURIComponent(PREVIEW_TENANT_SLUG)}`
  ) {
    return jsonResponse(previewChannels());
  }

  const channelRoute = pathname.match(
    /^\/api\/channels\/([^/]+)\/([^/]+)(?:\/(members))?$/
  );
  if (method === "GET" && channelRoute) {
    const [, tenantSlug, channelId, subresource] = channelRoute;
    if (tenantSlug === PREVIEW_TENANT_SLUG) {
      if (subresource === "members") {
        return jsonResponse(previewChannelMembers(channelId));
      }
      return jsonResponse(previewChannelDetails(channelId));
    }
  }

  if (
    method === "GET" &&
    pathname === `/api/dms/${encodeURIComponent(PREVIEW_TENANT_SLUG)}`
  ) {
    if (search.includes("picker=1")) {
      return jsonResponse({
        members: [
          {
            userId: "00000000-0000-4000-8000-000000000011",
            email: "jordan@kimiro.app",
            displayName: "Jordan Lee",
            image: null,
          },
          {
            userId: "00000000-0000-4000-8000-000000000012",
            email: "sam@kimiro.app",
            displayName: "Sam Rivera",
            image: null,
          },
        ],
      });
    }
    return jsonResponse(previewDms());
  }

  if (method === "GET" && pathname === "/api/reactions") {
    return jsonResponse([]);
  }

  if (method === "GET" && pathname === "/api/messages") {
    const params = new URLSearchParams(search);
    const chatId = params.get("chatId");
    const threadRootMessageId = params.get("threadRootMessageId");
    if (chatId) {
      return jsonResponse(
        previewMessagesForChat(chatId, threadRootMessageId)
      );
    }
    return jsonResponse({ messages: [], isMultiplayerRoom: false, isReadonly: false });
  }

  if (method === "GET" && pathname.startsWith("/api/auth/get-session")) {
    return jsonResponse({ user: previewShellContext.user });
  }

  if (method === "GET" && pathname === "/api/sign-in-options") {
    return jsonResponse({ googleEnabled: false, microsoftEnabled: false });
  }

  if (method === "POST" && pathname.startsWith("/api/")) {
    return jsonResponse(
      {
        error: "preview_mode",
        message: "This Vercel preview is UI-only. Connect the API to send messages.",
      },
      503
    );
  }

  if (method === "GET" && pathname.startsWith("/api/")) {
    return jsonResponse({});
  }

  return null;
}

export function installPreviewFetchMock(): void {
  if (!isPreviewMode() || typeof window === "undefined") {
    return;
  }

  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input, init) => {
    const { method, pathname, search } = resolveRequest(input, init);
    const mocked = previewResponse(method, pathname, search);
    if (mocked) {
      return Promise.resolve(mocked);
    }
    return nativeFetch(input, init);
  };
}
