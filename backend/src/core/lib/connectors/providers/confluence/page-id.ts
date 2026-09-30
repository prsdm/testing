export function parseConfluencePageId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
    );
    const pageMatch = url.pathname.match(/\/pages\/(\d+)/);
    if (pageMatch?.[1]) {
      return pageMatch[1];
    }
    const contentMatch = url.pathname.match(/\/content\/(\d+)/);
    if (contentMatch?.[1]) {
      return contentMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}
