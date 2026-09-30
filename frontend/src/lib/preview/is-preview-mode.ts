/** Static Vercel / demo deploys: mock API data and skip real auth. */
export function isPreviewMode(): boolean {
  if (import.meta.env.VITE_PREVIEW_MODE === "0") {
    return false;
  }
  if (import.meta.env.VITE_PREVIEW_MODE === "1") {
    return true;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.endsWith(".vercel.app")) {
      return true;
    }
  }
  return false;
}
