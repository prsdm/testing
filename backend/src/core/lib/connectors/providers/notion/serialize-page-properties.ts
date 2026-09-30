type NotionRichText = {
  plain_text?: string;
};

export type NotionUserLookup = Map<string, { name: string; email?: string }>;

function richTextToPlain(value?: NotionRichText[]) {
  return (value ?? [])
    .map((part) => part.plain_text ?? "")
    .join("")
    .trim();
}

function formatPersonLabel(input: { name?: string; email?: string }) {
  const name = input.name?.trim();
  const email = input.email?.trim();
  if (name && email) {
    return `${name} (${email})`;
  }
  if (name) {
    return name;
  }
  if (email) {
    return email;
  }
  return null;
}

function readPeopleText(
  people:
    | Array<{
        id?: string;
        name?: string;
        person?: { email?: string };
      }>
    | undefined,
  userById?: NotionUserLookup
) {
  const labels = (people ?? []).flatMap((person) => {
    const id = person.id?.trim();
    const lookup = id && userById?.has(id) ? userById.get(id) : undefined;
    const name = person.name?.trim() || lookup?.name?.trim();
    const email = person.person?.email?.trim() || lookup?.email?.trim();
    const label = formatPersonLabel({ email, name });
    return label ? [label] : [];
  });
  return labels.length > 0 ? labels.join(", ") : null;
}

function readPropertyText(
  value: Record<string, unknown>,
  userById?: NotionUserLookup
): string | null {
  const type = typeof value.type === "string" ? value.type : "";
  if (type === "title") {
    return null;
  }
  if (type === "rich_text") {
    const text = richTextToPlain(
      value.rich_text as NotionRichText[] | undefined
    );
    return text || null;
  }
  if (type === "number") {
    const numberValue = value.number;
    if (typeof numberValue === "number") {
      return String(numberValue);
    }
    return null;
  }
  if (type === "select") {
    const name = (value.select as { name?: string } | null)?.name?.trim();
    return name || null;
  }
  if (type === "status") {
    const name = (value.status as { name?: string } | null)?.name?.trim();
    return name || null;
  }
  if (type === "multi_select") {
    const names = (
      (value.multi_select as Array<{ name?: string }> | undefined) ?? []
    )
      .map((item) => item.name?.trim())
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : null;
  }
  if (type === "date") {
    const date = value.date as { start?: string; end?: string } | null;
    if (!date?.start) {
      return null;
    }
    if (date.end) {
      return `${date.start} → ${date.end}`;
    }
    return date.start;
  }
  if (type === "checkbox") {
    return value.checkbox === true ? "Yes" : "No";
  }
  if (type === "url") {
    const url = (value.url as string | null)?.trim();
    return url || null;
  }
  if (type === "email") {
    const email = (value.email as string | null)?.trim();
    return email || null;
  }
  if (type === "phone_number") {
    const phone = (value.phone_number as string | null)?.trim();
    return phone || null;
  }
  if (type === "people") {
    return readPeopleText(
      value.people as
        | Array<{
            id?: string;
            name?: string;
            person?: { email?: string };
          }>
        | undefined,
      userById
    );
  }
  if (type === "formula") {
    const formula = value.formula as {
      type?: string;
      string?: string;
      number?: number;
      boolean?: boolean;
      date?: { start?: string };
    };
    if (formula?.type === "string" && formula.string?.trim()) {
      return formula.string.trim();
    }
    if (formula?.type === "number" && typeof formula.number === "number") {
      return String(formula.number);
    }
    if (formula?.type === "boolean") {
      return formula.boolean ? "Yes" : "No";
    }
    if (formula?.type === "date" && formula.date?.start) {
      return formula.date.start;
    }
    return null;
  }
  if (type === "unique_id") {
    const prefix = (value.unique_id as { prefix?: string | null })?.prefix;
    const numberValue = (value.unique_id as { number?: number | null })?.number;
    if (typeof numberValue === "number") {
      return prefix ? `${prefix}-${numberValue}` : String(numberValue);
    }
    return null;
  }

  return null;
}

export function serializeNotionPageProperties(
  properties: Record<string, unknown>,
  userById?: NotionUserLookup
) {
  const lines: string[] = [];
  for (const [propertyKey, rawValue] of Object.entries(properties)) {
    if (!rawValue || typeof rawValue !== "object") {
      continue;
    }
    const text = readPropertyText(
      rawValue as Record<string, unknown>,
      userById
    );
    if (text) {
      lines.push(`${propertyKey}: ${text}`);
    }
  }
  return lines.join("\n");
}

export function propertiesNeedUserLookup(properties: Record<string, unknown>) {
  for (const rawValue of Object.values(properties)) {
    if (!rawValue || typeof rawValue !== "object") {
      continue;
    }
    const value = rawValue as {
      type?: string;
      people?: Array<{ id?: string; name?: string }>;
    };
    if (value.type !== "people") {
      continue;
    }
    for (const person of value.people ?? []) {
      if (!person.name?.trim() && person.id?.trim()) {
        return true;
      }
    }
  }
  return false;
}

export function toNotionUserLookup(
  users: Array<{ id: string; name: string; email?: string }>
): NotionUserLookup {
  return new Map(users.map((user) => [user.id, user]));
}

export function extractNotionPageTitleFromProperties(
  properties: Record<string, unknown>
) {
  for (const value of Object.values(properties)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const candidate = value as {
      type?: string;
      title?: NotionRichText[];
    };
    if (candidate.type !== "title") {
      continue;
    }
    const text = richTextToPlain(candidate.title);
    if (text) {
      return text;
    }
  }
  return "Untitled";
}
