import type { ReactNode } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import useSWR from "swr";
import { PanelErrorBoundary } from "@/components/app-error-boundary";
import { SessionIdleGuard } from "@/components/auth/session-idle-guard";
import { TenantShellSidebar } from "@/components/layouts/tenant-shell-sidebar";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { SessionUserProvider } from "@/components/providers/session-user-provider";
import { TenantProvider } from "@/components/providers/tenant-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import { isPreviewMode } from "@/lib/preview/is-preview-mode";
import { previewShellContext } from "@/lib/preview/preview-sample-data";
import type { WorkspaceShellContext } from "@/shared/workspace/shell-context-types";

async function fetchShellContext(): Promise<WorkspaceShellContext> {
  const response = await fetch("/api/workspace/shell", {
    credentials: "include",
  });
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  if (!response.ok || !isJson) {
    const body = isJson
      ? ((await response.json().catch(() => null)) as {
          error?: string;
        } | null)
      : null;
    const status = response.ok ? 401 : response.status;
    return {
      error: body?.error ?? "Unauthorized",
      ok: false,
      status: status as 401 | 403,
    };
  }
  return response.json() as Promise<WorkspaceShellContext>;
}

export function TenantAppShellClient({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const preview = isPreviewMode();
  const { data, error, isLoading } = useSWR(
    preview ? null : "workspace-shell",
    fetchShellContext,
    { revalidateOnFocus: !preview }
  );

  const shell = preview ? previewShellContext : data;

  useEffect(() => {
    if (preview) {
      return;
    }
    if (!data || data.ok) {
      return;
    }
    if (data.status === 401 || data.status === 404) {
      navigate("/login", { replace: true });
      return;
    }
    if (data.error === "access_denied") {
      navigate("/login?error=access_denied", { replace: true });
      return;
    }
    if (data.error === "no_workspace") {
      navigate("/login?error=no_workspace", { replace: true });
    }
  }, [data, navigate, preview]);

  useEffect(() => {
    if (preview) {
      return;
    }
    if (error) {
      navigate("/login", { replace: true });
    }
  }, [error, navigate, preview]);

  if (!shell?.ok) {
    if (preview) {
      return <div className="flex h-dvh bg-sidebar" />;
    }
    if (isLoading || error || !data || !data.ok) {
      return <div className="flex h-dvh bg-sidebar" />;
    }
    return <div className="flex h-dvh bg-sidebar" />;
  }

  const idleMs = shell.idleTimeoutMs;

  return (
    <TenantProvider
      capabilities={shell.capabilities}
      isAdmin={shell.isAdmin}
      tenantSlug={shell.tenantSlug}
    >
      <SessionUserProvider user={shell.user}>
        <OnboardingProvider>
          <SidebarProvider defaultOpen={shell.sidebarOpen}>
            {idleMs > 0 ? <SessionIdleGuard timeoutMs={idleMs} /> : null}
            <PanelErrorBoundary region="Sidebar">
              <TenantShellSidebar showAdminEntry={shell.showAdminEntry} />
            </PanelErrorBoundary>
            <SidebarInset className="bg-background">
              <ActiveChatProvider>
                <Toaster
                  className="z-200!"
                  position="top-center"
                  theme="system"
                  toastOptions={{
                    className:
                      "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
                  }}
                />
                <PanelErrorBoundary className="m-4" region="Page">
                  {children}
                </PanelErrorBoundary>
              </ActiveChatProvider>
            </SidebarInset>
          </SidebarProvider>
        </OnboardingProvider>
      </SessionUserProvider>
    </TenantProvider>
  );
}
