import { confluencePostSpace } from "@/core/lib/connectors/providers/confluence/api";
import { assertConfluenceActionAllowed } from "@/core/lib/connectors/providers/confluence/auth";
import { normalizeAtlassianSourceLink } from "@/shared/connectors/providers/confluence/url";

function buildConfluenceSpaceLink(siteUrl: string, spaceKey: string) {
  const base = siteUrl.trim().replace(/\/+$/, "");
  return `${base}/wiki/spaces/${encodeURIComponent(spaceKey)}`;
}

export async function confluenceCreateSpace(input: {
  tenantId: string;
  siteUrl: string;
  cloudId: string;
  accessToken: string;
  spaceKey: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
}): Promise<{
  spaceKey: string;
  name: string;
  spaceId?: string;
  link: string;
}> {
  await assertConfluenceActionAllowed({
    action: "create",
    tenantId: input.tenantId,
  });

  const spaceKey = input.spaceKey.trim().toUpperCase();
  if (!spaceKey) {
    throw new Error("spaceKey is required.");
  }
  if (!/^[A-Z0-9]+$/.test(spaceKey)) {
    throw new Error(
      "spaceKey must contain only uppercase letters and numbers (for example ENG)."
    );
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error("name is required.");
  }

  let created: Awaited<ReturnType<typeof confluencePostSpace>>;
  try {
    created = await confluencePostSpace({
      accessToken: input.accessToken,
      cloudId: input.cloudId,
      description: input.description,
      isPrivate: input.isPrivate,
      name,
      spaceKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("(401)") && message.includes("scope does not match")) {
      throw new Error(
        "Confluence connection is missing write:space:confluence. Disconnect and reconnect Confluence to grant the updated scopes."
      );
    }
    if (message.includes("(404)")) {
      throw new Error(
        "Confluence space creation is unavailable on this site (v2 create requires Role-Based Access Control). Ask your Confluence admin to enable RBAC or create the space manually."
      );
    }
    throw error;
  }

  const resolvedKey = created.key?.trim() || spaceKey;
  const resolvedName = created.name?.trim() || name;
  const webUi = created._links?.webui?.trim();
  const link = webUi
    ? normalizeAtlassianSourceLink(
        webUi.startsWith("http")
          ? webUi
          : `${input.siteUrl.replace(/\/+$/, "")}${webUi.startsWith("/") ? "" : "/"}${webUi}`
      )
    : buildConfluenceSpaceLink(input.siteUrl, resolvedKey);

  return {
    link,
    name: resolvedName,
    spaceId: created.id?.trim() || undefined,
    spaceKey: resolvedKey,
  };
}
