import { disconnectNotionForUser } from "@/core/lib/connectors/providers/notion/request-context";

export async function POST(request: Request) {
  let tenantSlug: string | undefined;
  try {
    const body = (await request.json()) as { tenantSlug?: string };
    tenantSlug = body.tenantSlug?.trim();
  } catch {
    tenantSlug = undefined;
  }

  if (!tenantSlug) {
    return Response.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  const result = await disconnectNotionForUser(tenantSlug);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}
