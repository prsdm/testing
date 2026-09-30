import { requestCookies } from "@/core/lib/http/request-context";
import { loadWorkspaceShellContext } from "@/core/lib/workspace/shell-context";

export async function GET() {
  const cookieStore = requestCookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value === "true";
  const context = await loadWorkspaceShellContext({ sidebarOpen });

  if (!context.ok) {
    return Response.json({ error: context.error }, { status: context.status });
  }

  return Response.json(context);
}
