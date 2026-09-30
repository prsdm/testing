import type { CapabilityId } from "@/shared/auth/capabilities";
import type { AppSession } from "@/shared/auth/types";

export type WorkspaceShellContext =
  | { ok: false; status: 401 | 403; error: string }
  | {
      ok: true;
      user: AppSession["user"];
      tenantSlug: string;
      isAdmin: boolean;
      showAdminEntry: boolean;
      capabilities: CapabilityId[];
      sidebarOpen: boolean;
      idleTimeoutMs: number;
    };
