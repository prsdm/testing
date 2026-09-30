import { z } from "zod";
import { disconnectJiraForUser } from "@/core/lib/connectors/providers/jira/request-context";

const bodySchema = z.object({
  tenantSlug: z.string().min(1),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await disconnectJiraForUser(body.tenantSlug);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ ok: true });
}
