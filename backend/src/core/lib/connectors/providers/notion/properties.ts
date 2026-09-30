export function findTitlePropertyKey(properties: Record<string, unknown>) {
  for (const [key, value] of Object.entries(properties)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    if ((value as { type?: string }).type === "title") {
      return key;
    }
  }
  return "title";
}

export function buildTitlePropertyValue(title: string) {
  return {
    title: [{ text: { content: title }, type: "text" }],
  };
}

export function parseNotionPropertiesJson(raw?: string) {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("properties must be valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("properties must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}
