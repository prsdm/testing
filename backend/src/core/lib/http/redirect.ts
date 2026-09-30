export function throwApiRedirect(url: string | URL): never {
  throw new Error(`Redirect is unavailable in the API runtime: ${url}`);
}
