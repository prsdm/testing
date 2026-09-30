export function getSignInOptions() {
  return {
    googleEnabled: Boolean(
      process.env.GOOGLE_CLIENT_ID?.trim() &&
        process.env.GOOGLE_CLIENT_SECRET?.trim()
    ),
    microsoftEnabled: Boolean(
      process.env.MICROSOFT_CLIENT_ID?.trim() &&
        process.env.MICROSOFT_CLIENT_SECRET?.trim()
    ),
  };
}
