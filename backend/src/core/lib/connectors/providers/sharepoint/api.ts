export type SharePointPageRef = {
  siteId: string;
  pageId: string;
};

export async function graphFetch(args: {
  accessToken: string;
  path: string;
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
}) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${args.path}`, {
    body: args.body ? JSON.stringify(args.body) : undefined,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${args.accessToken}`,
      ...(args.body ? { "content-type": "application/json" } : {}),
    },
    method: args.method ?? "GET",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `SharePoint API ${args.path} failed (${response.status}): ${body.slice(0, 300)}`
    );
  }
  return response;
}

export function sharePointPageResult(args: {
  siteId: string;
  pageId: string;
  title: string;
  link: string;
}) {
  return {
    externalRef: `${args.siteId}::${args.pageId}`,
    link: args.link,
    pageId: args.pageId,
    siteId: args.siteId,
    title: args.title,
  };
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function plainTextToInnerHtml(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "<p></p>";
  }
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph
        .split("\n")
        .map((line) => escapeHtml(line.trim()))
        .filter(Boolean);
      if (lines.length === 0) {
        return "";
      }
      return `<p>${lines.join("<br/>")}</p>`;
    })
    .filter(Boolean)
    .join("");
}

export function buildSimpleCanvasLayout(innerHtml: string) {
  return {
    horizontalSections: [
      {
        columns: [
          {
            id: "1",
            webparts: [
              {
                "@odata.type": "#microsoft.graph.textWebPart",
                innerHtml,
              },
            ],
            width: 12,
          },
        ],
        emphasis: "none",
        id: "1",
        layout: "fullWidth",
      },
    ],
  };
}

export function slugifySharePointPageName(title: string) {
  const base =
    title
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-+|-+$/g, "") || "page";
  return `${base}-${Date.now().toString(36).slice(-6)}.aspx`;
}

export async function sharePointPublishPage(
  args: SharePointPageRef & {
    accessToken: string;
  }
) {
  await graphFetch({
    accessToken: args.accessToken,
    method: "POST",
    path: `/sites/${encodeURIComponent(args.siteId)}/pages/${encodeURIComponent(args.pageId)}/microsoft.graph.sitePage/publish`,
  });
}

export async function sharePointPatchPage(
  args: SharePointPageRef & {
    accessToken: string;
    title?: string;
    innerHtml?: string;
  }
) {
  const body: Record<string, unknown> = {
    "@odata.type": "#microsoft.graph.sitePage",
  };
  if (args.title?.trim()) {
    body.title = args.title.trim();
  }
  if (args.innerHtml !== undefined) {
    body.canvasLayout = buildSimpleCanvasLayout(args.innerHtml);
  }
  const response = await graphFetch({
    accessToken: args.accessToken,
    body,
    method: "PATCH",
    path: `/sites/${encodeURIComponent(args.siteId)}/pages/${encodeURIComponent(args.pageId)}/microsoft.graph.sitePage`,
  });
  return (await response.json()) as {
    id?: string;
    title?: string;
    webUrl?: string;
  };
}

export async function sharePointCreatePageGraph(args: {
  accessToken: string;
  siteId: string;
  name: string;
  title: string;
  innerHtml: string;
}) {
  const response = await graphFetch({
    accessToken: args.accessToken,
    body: {
      "@odata.type": "#microsoft.graph.sitePage",
      canvasLayout: buildSimpleCanvasLayout(args.innerHtml),
      name: args.name,
      pageLayout: "article",
      showComments: true,
      showRecommendedPages: false,
      title: args.title,
      titleArea: {
        enableGradientEffect: true,
        layout: "colorBlock",
        showAuthor: true,
        showPublishedDate: false,
        textAlignment: "left",
      },
    },
    method: "POST",
    path: `/sites/${encodeURIComponent(args.siteId)}/pages`,
  });
  return (await response.json()) as {
    id?: string;
    title?: string;
    webUrl?: string;
  };
}
