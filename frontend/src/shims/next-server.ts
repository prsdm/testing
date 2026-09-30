export async function connection(): Promise<void> {}

export function after(_callback: () => void | Promise<void>) {
  /* no-op in SPA typecheck */
}

export class NextResponse extends Response {
  static json(body: unknown, init?: ResponseInit): NextResponse {
    return new NextResponse(JSON.stringify(body), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  }

  cookies = {
    set: (_name: string, _value: string, _options?: unknown) => {
      /* no-op */
    },
  };
}
