export type SlackCredentialSecretFields = {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  scope: string;
  teamId: string | null;
  teamName: string | null;
  teamUrl: string | null;
  userId: string | null;
  userEmail: string;
};

/** Build the JSON secret stored for a Slack user OAuth credential. */
export function buildSlackCredentialSecretPayload(
  args: SlackCredentialSecretFields
): string {
  const expiresAt =
    typeof args.expiresIn === "number" && Number.isFinite(args.expiresIn)
      ? Date.now() + args.expiresIn * 1000
      : null;

  return JSON.stringify({
    access_token: args.accessToken,
    expires_at: expiresAt,
    refresh_token: args.refreshToken?.trim() || null,
    scope: args.scope,
    team_id: args.teamId,
    team_name: args.teamName,
    team_url: args.teamUrl,
    user_email: args.userEmail,
    user_id: args.userId,
  });
}
