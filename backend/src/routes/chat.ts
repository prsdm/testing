import type { Application } from "express";
import * as workspaceLogoRoute from "@/core/server/api/workspace/[tenantSlug]/logo/route";
import * as workspaceModelsRoute from "@/core/server/api/workspace/[tenantSlug]/models/route";
import * as workspaceRoute from "@/core/server/api/workspace/route";
import * as workspaceShellRoute from "@/core/server/api/workspace/shell/route";
import * as chatMessageSearchRoute from "@/core/server/chat-api/chat/[id]/messages/search/route";
import * as chatReadRoute from "@/core/server/chat-api/chat/[id]/read/route";
import * as chatRunArtifactsRoute from "@/core/server/chat-api/chat/[id]/runs/[runId]/artifacts/route";
import * as chatRunCancelRoute from "@/core/server/chat-api/chat/[id]/runs/[runId]/cancel/route";
import * as chatRunRoute from "@/core/server/chat-api/chat/[id]/runs/[runId]/route";
import * as chatRunStreamRoute from "@/core/server/chat-api/chat/[id]/runs/[runId]/stream/route";
import * as chatRunToolApprovalRoute from "@/core/server/chat-api/chat/[id]/runs/[runId]/tool-approval/route";
import * as chatRunToolRetryRoute from "@/core/server/chat-api/chat/[id]/runs/[runId]/tool-retry/route";
import * as chatRunsRoute from "@/core/server/chat-api/chat/[id]/runs/route";
import * as chatRoute from "@/core/server/chat-api/chat/route";
import * as documentRoute from "@/core/server/chat-api/document/route";
import * as filesContentRoute from "@/core/server/chat-api/files/content/route";
import * as filesUploadRoute from "@/core/server/chat-api/files/upload/route";
import * as freeTrialRoute from "@/core/server/chat-api/free-trial/route";
import * as historyRoute from "@/core/server/chat-api/history/route";
import * as messagesRoute from "@/core/server/chat-api/messages/route";
import * as modelsRoute from "@/core/server/chat-api/models/route";
import * as reactionsRoute from "@/core/server/chat-api/reactions/route";
import * as suggestionsRoute from "@/core/server/chat-api/suggestions/route";
import * as threadTagsRoute from "@/core/server/chat-api/thread-tags/route";
import * as voteRoute from "@/core/server/chat-api/vote/route";
import { mountAppRoute } from "./mount-app-route";

export function mount(app: Application) {
  mountAppRoute(app, "/api/chat", chatRoute);
  mountAppRoute(app, "/api/chat/:id/read", chatReadRoute);
  mountAppRoute(app, "/api/chat/:id/messages/search", chatMessageSearchRoute);
  mountAppRoute(app, "/api/chat/:id/runs", chatRunsRoute);
  mountAppRoute(app, "/api/chat/:id/runs/:runId", chatRunRoute);
  mountAppRoute(app, "/api/chat/:id/runs/:runId/stream", chatRunStreamRoute);
  mountAppRoute(app, "/api/chat/:id/runs/:runId/cancel", chatRunCancelRoute);
  mountAppRoute(
    app,
    "/api/chat/:id/runs/:runId/artifacts",
    chatRunArtifactsRoute
  );
  mountAppRoute(
    app,
    "/api/chat/:id/runs/:runId/tool-approval",
    chatRunToolApprovalRoute
  );
  mountAppRoute(
    app,
    "/api/chat/:id/runs/:runId/tool-retry",
    chatRunToolRetryRoute
  );
  mountAppRoute(app, "/api/document", documentRoute);
  mountAppRoute(app, "/api/files/content", filesContentRoute);
  mountAppRoute(app, "/api/files/upload", filesUploadRoute);
  mountAppRoute(app, "/api/free-trial", freeTrialRoute);
  mountAppRoute(app, "/api/history", historyRoute);
  mountAppRoute(app, "/api/messages", messagesRoute);
  mountAppRoute(app, "/api/models", modelsRoute);
  mountAppRoute(app, "/api/suggestions", suggestionsRoute);
  mountAppRoute(app, "/api/reactions", reactionsRoute);
  mountAppRoute(app, "/api/thread-tags", threadTagsRoute);
  mountAppRoute(app, "/api/vote", voteRoute);
  mountAppRoute(app, "/api/workspace", workspaceRoute);
  mountAppRoute(app, "/api/workspace/shell", workspaceShellRoute);
  mountAppRoute(app, "/api/workspace/:tenantSlug/models", workspaceModelsRoute);
  mountAppRoute(app, "/api/workspace/:tenantSlug/logo", workspaceLogoRoute);
}
