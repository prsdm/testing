import { parseNotionPropertiesJson } from "@/core/lib/connectors/providers/notion/properties";

export function defaultDatabasePropertiesSchema() {
  return {
    Name: { title: {} },
    Status: { status: {} },
  };
}

function schemaHasTitleProperty(schema: Record<string, unknown>) {
  for (const value of Object.values(schema)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    if ("title" in value) {
      return true;
    }
  }
  return false;
}

export function resolveDatabasePropertiesSchema(raw?: string) {
  const schema = raw?.trim()
    ? parseNotionPropertiesJson(raw)
    : defaultDatabasePropertiesSchema();
  if (!schemaHasTitleProperty(schema)) {
    throw new Error(
      'Database properties schema must include at least one title column, e.g. {"Name":{"title":{}}}.'
    );
  }
  return schema;
}
