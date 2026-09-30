import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { auth } from "@/core/lib/auth/server-session";
import { subscribeUserChatInbox } from "@/core/lib/chat/chat-inbox-bus";
import {
  getTenantBySlug,
  isTenantMemberAccessAllowed,
} from "@/core/lib/db/queries";
import { resolveTenantForUser } from "@/core/lib/tenant/resolve-tenant-for-user";
import { runWithIncomingMessage } from "@/load-request-context";

const HEARTBEAT_MS = 25_000;

const INBOX_WS_PATH = /^\/api\/workspace\/([^/]+)\/inbox\/ws\/?$/;

function inboxWebSocketTenantSlug(pathname: string): string | null {
  const match = INBOX_WS_PATH.exec(pathname);
  return match?.[1] ?? null;
}

async function authorizeInboxSubscription(
  tenantSlug: string
): Promise<
  | { ok: true; authUserId: string; tenantSlug: string }
  | { ok: false; closeCode: number; reason: string }
> {
  const session = await auth();
  if (!session?.user?.email) {
    return { closeCode: 4401, ok: false, reason: "Unauthorized" };
  }

  const [tenantForUser, tenant] = await Promise.all([
    resolveTenantForUser({
      authUserId: session.user.id,
      email: session.user.email,
      preferredTenantSlug: tenantSlug,
    }),
    getTenantBySlug(tenantSlug),
  ]);

  if (!tenant || !tenantForUser || tenantForUser.slug !== tenant.slug) {
    return { closeCode: 4403, ok: false, reason: "Forbidden" };
  }

  const memberAllowed = await isTenantMemberAccessAllowed({
    authUserId: session.user.id,
    tenantId: tenant.id,
  });
  if (!memberAllowed) {
    return { closeCode: 4403, ok: false, reason: "Forbidden" };
  }

  return {
    authUserId: session.user.id,
    ok: true,
    tenantSlug: tenant.slug,
  };
}

async function handleInboxSocket(
  ws: WebSocket,
  req: IncomingMessage,
  tenantSlug: string
) {
  await runWithIncomingMessage(req, async () => {
    const access = await authorizeInboxSubscription(tenantSlug);
    if (!access.ok) {
      ws.close(access.closeCode, access.reason);
      return;
    }

    ws.send(
      JSON.stringify({
        tenantSlug: access.tenantSlug,
        type: "connected",
      })
    );

    const unsubscribe = subscribeUserChatInbox(access.authUserId, (event) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    });

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, HEARTBEAT_MS);

    const close = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    ws.on("close", close);
    ws.on("error", close);
  });
}

export function attachWorkspaceInboxWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const host = req.headers.host ?? "127.0.0.1";
    const pathname = new URL(req.url ?? "/", `http://${host}`).pathname;
    const tenantSlug = inboxWebSocketTenantSlug(pathname);
    if (!tenantSlug) {
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      void handleInboxSocket(ws, req, tenantSlug);
    });
  });
}
