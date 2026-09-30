function emailLocalPart(email: string) {
  const localPart = email.split("@")[0]?.trim().toLowerCase();
  if (!localPart || localPart === email.toLowerCase()) {
    return null;
  }
  return localPart;
}

function collectUserSearchHints(args: {
  userEmail: string;
  userName?: string | null;
}) {
  const hints = new Set<string>();
  const email = args.userEmail.trim().toLowerCase();
  if (email) {
    hints.add(email);
    const localPart = emailLocalPart(email);
    if (localPart) {
      hints.add(localPart);
    }
  }
  const name = args.userName?.trim();
  if (name) {
    hints.add(name);
  }
  return [...hints];
}

const FIRST_PERSON_PATTERN = /\b(?:me|my|mine|myself|assigned to me|for me)\b/i;

export function expandKnowledgeSearchQueryForUser(args: {
  query: string;
  userEmail: string;
  userName?: string | null;
}) {
  const query = args.query.trim();
  if (!query || !FIRST_PERSON_PATTERN.test(query)) {
    return query;
  }

  const hints = collectUserSearchHints(args);
  if (hints.length === 0) {
    return query;
  }

  return `${query} ${hints.join(" ")}`.trim();
}

export function formatKnowledgeSearchUserContext(args: {
  userEmail: string;
  userName?: string | null;
  preferredName?: string | null;
}) {
  const hints = collectUserSearchHints(args);
  if (hints.length === 0) {
    return null;
  }

  const email = args.userEmail.trim();
  const name = args.userName?.trim();
  const identity =
    name && email ? `${name} (${email})` : name || email || hints.join(", ");

  const lines = [
    `The current user is ${identity}. When they say "me", "my", or "assigned to me", use this identity.`,
  ];
  const preferred = args.preferredName?.trim();
  if (preferred) {
    lines.push(`Address the user as "${preferred}" in conversation.`);
  }
  return lines.join("\n");
}
