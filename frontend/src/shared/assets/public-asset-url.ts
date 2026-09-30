/** Browser URL for a file under `public/` (respects `KIMIRO_BASE_PATH`). */
export function publicAssetUrl(relativePath: string): string {
  const base = (process.env.KIMIRO_BASE_PATH ?? "").replace(/\/$/, "");
  const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${base}${path}`;
}

export const SANDBOX_WORK_SKILL_LOGOS = {
  docs: "logos/document.png",
  pdf: "logos/pdfnew.png",
  slides: "logos/slidesnew.png",
  xlsx: "logos/sheetnew.png",
} as const;
