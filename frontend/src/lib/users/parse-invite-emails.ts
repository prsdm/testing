const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split invite input on commas, semicolons, or whitespace; dedupe lowercase. */
export function parseInviteEmails(raw: string): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];

  for (const part of raw.split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase();
    if (!email || seen.has(email)) {
      continue;
    }
    seen.add(email);
    emails.push(email);
  }

  return emails;
}

export function isValidInviteEmail(email: string) {
  return EMAIL_PATTERN.test(email);
}
