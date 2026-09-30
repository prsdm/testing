import {
  listNotionWorkspaceUsers,
  type NotionWorkspaceUser,
  resolveNotionUserByQuery,
} from "@/core/lib/connectors/providers/notion/resolve-notion-user";

function buildPeoplePropertyValue(userId: string) {
  return {
    people: [{ id: userId, object: "user" }],
  };
}

function isPeoplePropertyKey(propertyKey: string) {
  return /assignee|assigned|assign|owner|people|person|reporter|lead/i.test(
    propertyKey
  );
}

function propertyNeedsUserResolution(propertyKey: string, value: unknown) {
  if (typeof value === "string") {
    return isPeoplePropertyKey(propertyKey);
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return Array.isArray((value as { people?: unknown[] }).people);
  }
  return false;
}

async function resolvePeopleEntry(input: {
  accessToken: string;
  entry: unknown;
  users?: NotionWorkspaceUser[];
}) {
  if (typeof input.entry !== "object" || input.entry === null) {
    throw new Error("Invalid people property entry.");
  }
  const entry = input.entry as Record<string, unknown>;
  if (typeof entry.id === "string" && entry.id.trim()) {
    return { id: entry.id.trim(), object: "user" };
  }
  const nameQuery =
    typeof entry.name === "string"
      ? entry.name
      : typeof entry.email === "string"
        ? entry.email
        : undefined;
  if (!nameQuery?.trim()) {
    throw new Error("People property entries need id, name, or email.");
  }
  const user = await resolveNotionUserByQuery({
    accessToken: input.accessToken,
    query: nameQuery,
    users: input.users,
  });
  return { id: user.id, object: "user" };
}

async function resolvePropertyValue(input: {
  accessToken: string;
  propertyKey: string;
  value: unknown;
  users?: NotionWorkspaceUser[];
}) {
  if (typeof input.value === "string") {
    if (!isPeoplePropertyKey(input.propertyKey)) {
      throw new Error(
        `Property "${input.propertyKey}" uses a plain string. Use full Notion JSON for status/select, or an Assignee-style property name for people shorthand.`
      );
    }
    const user = await resolveNotionUserByQuery({
      accessToken: input.accessToken,
      query: input.value,
      users: input.users,
    });
    return buildPeoplePropertyValue(user.id);
  }

  if (typeof input.value !== "object" || input.value === null) {
    return input.value;
  }
  if (Array.isArray(input.value)) {
    return input.value;
  }

  const propertyValue = input.value as Record<string, unknown>;
  if (!Array.isArray(propertyValue.people)) {
    return propertyValue;
  }

  const people = await Promise.all(
    propertyValue.people.map((entry) =>
      resolvePeopleEntry({
        accessToken: input.accessToken,
        entry,
        users: input.users,
      })
    )
  );
  return {
    ...propertyValue,
    people,
  };
}

export async function resolveNotionRowProperties(input: {
  accessToken: string;
  properties: Record<string, unknown>;
}) {
  const needsUsers = Object.entries(input.properties).some(
    ([propertyKey, value]) => propertyNeedsUserResolution(propertyKey, value)
  );
  const users = needsUsers
    ? await listNotionWorkspaceUsers(input.accessToken)
    : undefined;

  const resolvedEntries = await Promise.all(
    Object.entries(input.properties).map(async ([propertyKey, value]) => {
      const resolvedValue = await resolvePropertyValue({
        accessToken: input.accessToken,
        propertyKey,
        users,
        value,
      });
      return [propertyKey, resolvedValue] as const;
    })
  );

  return Object.fromEntries(resolvedEntries);
}
