/**
 * Revoke a Google OAuth token so the next authorize request must show consent.
 * Without this, Google often auto-approves previously granted scopes and skips
 * the consent screen even when prompt=consent is set.
 */
export async function revokeGoogleOAuthToken(token: string | null | undefined) {
  const trimmed = token?.trim();
  if (!trimmed) {
    return;
  }

  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      body: new URLSearchParams({ token: trimmed }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });
  } catch {
    // Best-effort — still continue to consent redirect.
  }
}
