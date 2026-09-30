export function assertConnectorAccountMatchesUserEmail(args: {
  providerAccountEmail: string;
  userEmail: string;
  providerLabel?: string;
}) {
  const accountEmail = args.providerAccountEmail.trim().toLowerCase();
  const signedInEmail = args.userEmail.trim().toLowerCase();
  const providerLabel = args.providerLabel ?? "Connected account";

  if (!accountEmail || !signedInEmail) {
    throw new Error(
      `${providerLabel} email must match your signed-in workspace email.`
    );
  }

  if (accountEmail !== signedInEmail) {
    throw new Error(
      `${providerLabel} must match your signed-in email (${signedInEmail}).`
    );
  }
}
