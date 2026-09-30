/** URL prefix when the app is hosted under a subpath (empty at root). */
export function kimiroBasePath(): string {
  if (typeof process !== "undefined" && process.env?.KIMIRO_BASE_PATH != null) {
    return process.env.KIMIRO_BASE_PATH;
  }
  return "";
}

export function kimiroApiPath(path: string): string {
  const base = kimiroBasePath();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
