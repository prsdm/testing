/** Types-only stub so shared `lib/` modules resolve under web typecheck. */
type CookieStore = {
  get: (name: string) => { name: string; value: string } | undefined;
  set: (name: string, value: string, options?: unknown) => void;
  delete: (name: string) => void;
};

export async function headers(): Promise<Headers> {
  throw new Error("next/headers is not available in the SPA");
}

export async function cookies(): Promise<CookieStore> {
  throw new Error("next/headers is not available in the SPA");
}

export async function redirect(_url: string | URL): Promise<never> {
  throw new Error("next/headers redirect is not available in the SPA");
}
