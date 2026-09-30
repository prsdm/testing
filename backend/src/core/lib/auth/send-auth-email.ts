/**
 * Deliver magic-link emails.
 * - With RESEND_API_KEY: send via Resend
 * - Otherwise: log the URL (local/dev)
 */
export async function sendAuthEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.AUTH_EMAIL_FROM?.trim() || "Kimiro <onboarding@resend.dev>";

  if (!apiKey) {
    console.info("[auth-email]", { subject, text, to });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from,
      subject,
      text,
      to: [to],
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Failed to send auth email: ${response.status} ${body}`);
  }
}
