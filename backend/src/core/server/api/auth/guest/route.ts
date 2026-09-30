export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRedirect = searchParams.get("redirectUrl") || "/";
  const redirectUrl =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/";
  const base = process.env.KIMIRO_BASE_PATH ?? "";

  return Response.redirect(
    new URL(
      `${base}/login?redirectUrl=${encodeURIComponent(redirectUrl)}`,
      request.url
    ),
    302
  );
}
