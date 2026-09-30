export function getConfluenceOAuthRedirectUri() {
  const base =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3001";
  return `${base}/api/connectors/oauth/confluence/callback`;
}
