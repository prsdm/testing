import { disconnectGoogleAppForUser } from "@/core/lib/connectors/providers/google-shared/request-context";
import {
  type GoogleAppId,
  getGoogleWorkspaceApp,
} from "@/shared/connectors/providers/google-shared/apps";

export async function POST(request: Request) {
  let tenantSlug: string | undefined;
  let app: string | undefined;
  try {
    const body = (await request.json()) as {
      tenantSlug?: string;
      app?: string;
    };
    tenantSlug = body.tenantSlug?.trim();
    app = body.app?.trim();
  } catch {
    tenantSlug = undefined;
    app = undefined;
  }

  if (!tenantSlug || !app) {
    return Response.json(
      { error: "tenantSlug and app are required" },
      { status: 400 }
    );
  }

  if (!getGoogleWorkspaceApp(app)) {
    return Response.json({ error: "Invalid app." }, { status: 400 });
  }

  const result = await disconnectGoogleAppForUser(
    tenantSlug,
    app as GoogleAppId
  );
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ ok: true });
}
