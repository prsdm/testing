/** User-facing filename for code artifacts. */
export function codeDocumentFileName(title: string) {
  const trimmed = title.trim();
  if (!trimmed) {
    return "code.txt";
  }
  if (/\.[a-z0-9]+$/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}.txt`;
}

export function downloadTextContent(
  filename: string,
  content: string,
  mimeType = "text/plain;charset=utf-8"
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
