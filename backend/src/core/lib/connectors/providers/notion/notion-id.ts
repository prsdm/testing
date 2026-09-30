const NOTION_ID_BODY_PATTERN = /^[0-9a-f]{32}$/i;
const NOTION_UUID_PATTERN =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

function compactNotionId(value: string) {
  return value.trim().replace(/-/g, "");
}

export function isNotionUuid(value: string) {
  const compact = compactNotionId(value);
  return (
    NOTION_ID_BODY_PATTERN.test(compact) &&
    NOTION_UUID_PATTERN.test(value.trim())
  );
}

export function parseNotionId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (isNotionUuid(trimmed)) {
    return compactNotionId(trimmed);
  }

  const withoutQuery = trimmed.split("?")[0] ?? trimmed;
  const tailMatch = withoutQuery.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  );
  if (tailMatch?.[1] && isNotionUuid(tailMatch[1])) {
    return compactNotionId(tailMatch[1]);
  }

  const hexMatch = withoutQuery.match(/([0-9a-f]{32})$/i);
  if (hexMatch?.[1] && NOTION_ID_BODY_PATTERN.test(hexMatch[1])) {
    return hexMatch[1].toLowerCase();
  }

  return null;
}

export function slugLikeIdToTitle(value: string) {
  return value.trim().replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

export function invalidNotionIdMessage(label: string, value: string) {
  return `${label} "${value}" is not a valid Notion UUID or URL. Use rowTitle with databaseTitle instead, or rowId from a prior tool result in this chat. Do not invent placeholder IDs.`;
}
