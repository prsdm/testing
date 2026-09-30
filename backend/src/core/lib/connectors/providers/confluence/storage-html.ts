export function toStorageHtml(content: string) {
  const escaped = content
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const body = escaped.replaceAll("\n", "<br/>").trim();
  return body ? `<p>${body}</p>` : "<p></p>";
}

export function appendStorageHtml(existingHtml: string, content: string) {
  const nextBlock = toStorageHtml(content);
  const trimmedExisting = existingHtml.trim();
  if (!trimmedExisting || trimmedExisting === "<p></p>") {
    return nextBlock;
  }
  return `${trimmedExisting}${nextBlock}`;
}

export function mergePageStorageHtml(args: {
  existingHtml: string;
  content: string;
  contentMode: "append" | "replace";
}) {
  if (args.contentMode === "replace") {
    return toStorageHtml(args.content);
  }
  return appendStorageHtml(args.existingHtml, args.content);
}
