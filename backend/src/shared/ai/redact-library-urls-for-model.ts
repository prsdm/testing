/** Remove file URLs from library tool payloads before the model sees them. */

export function redactLibraryToolOutputForModel(
  toolName: string | undefined,
  value: unknown
): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (toolName === "saveToLibrary" || toolName === "generateImage") {
    const {
      url: _url,
      name: _name,
      ...record
    } = value as Record<string, unknown>;
    return record;
  }

  if (toolName === "listLibrary") {
    const record = { ...(value as Record<string, unknown>) };
    if (Array.isArray(record.files)) {
      record.files = record.files.map((file) => {
        if (!file || typeof file !== "object") {
          return file;
        }
        const { url: _url, ...fileRecord } = file as Record<string, unknown>;
        return fileRecord;
      });
    }
    return record;
  }

  return value;
}
