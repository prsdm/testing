import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { WorkspaceChatProviders } from "@/components/chat/workspace-chat-providers";
import { WorkspaceChatViewport } from "@/components/chat/workspace-chat-viewport";
import { TenantAppShellClient } from "../components/tenant-app-shell-client";

export function WorkspaceLayout() {
  return (
    <Suspense fallback={<div className="flex h-dvh bg-sidebar" />}>
      <WorkspaceChatProviders>
        <Suspense fallback={<div className="flex h-dvh bg-sidebar" />}>
          <TenantAppShellClient>
            <WorkspaceChatViewport>
              <Outlet />
            </WorkspaceChatViewport>
          </TenantAppShellClient>
        </Suspense>
      </WorkspaceChatProviders>
    </Suspense>
  );
}
