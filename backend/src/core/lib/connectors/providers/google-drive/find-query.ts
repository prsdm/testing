export function escapeDriveQueryLiteral(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function buildDriveNameSearchQuery(input: {
  name: string;
  folderOnly?: boolean;
  parentId?: string;
}) {
  const escapedName = escapeDriveQueryLiteral(input.name.trim());
  const parts = [`name contains '${escapedName}'`, "trashed = false"];
  if (input.folderOnly) {
    parts.push("mimeType = 'application/vnd.google-apps.folder'");
  }
  if (input.parentId?.trim()) {
    parts.push(
      `'${escapeDriveQueryLiteral(input.parentId.trim())}' in parents`
    );
  }
  return parts.join(" and ");
}
