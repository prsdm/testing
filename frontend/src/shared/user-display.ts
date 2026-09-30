/**
 * Display helpers aligned with Onyx user avatar / sidebar labeling.
 */

export function getUserDisplayName(args: {
  name?: string | null;
  email?: string | null;
}) {
  const name = args.name?.trim();
  if (name) {
    return name;
  }

  const email = args.email?.trim();
  if (email) {
    const atIndex = email.indexOf("@");
    if (atIndex > 0) {
      return email.slice(0, atIndex);
    }
  }

  return email ?? "User";
}

export function getUserFirstName(args: {
  name?: string | null;
  email?: string | null;
}) {
  const name = args.name?.trim();
  if (name) {
    const firstName = name.split(/\s+/)[0];
    if (firstName) {
      return firstName;
    }
  }

  const email = args.email?.trim();
  if (email) {
    const atIndex = email.indexOf("@");
    if (atIndex > 0) {
      const localPart = email.slice(0, atIndex);
      const segment = localPart.split(/[._-]/)[0];
      if (segment) {
        return segment;
      }
    }
  }

  return null;
}

/**
 * Derive display initials from a user's name or email.
 * Returns null when no valid alpha initials can be derived (show generic user icon).
 */
export function getUserInitials(
  name: string | null | undefined,
  email: string
): string | null {
  if (name?.trim()) {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      const first = words[0]?.[0];
      const second = words[1]?.[0];
      if (first && second) {
        const result = (first + second).toUpperCase();
        if (/^[A-Z]{2}$/.test(result)) {
          return result;
        }
      }
      return null;
    }
    if (name.trim().length >= 1) {
      const result = name.trim().slice(0, 2).toUpperCase();
      if (/^[A-Z]{1,2}$/.test(result)) {
        return result;
      }
    }
  }

  const local = email.split("@")[0];
  if (!local || local.length === 0) {
    return null;
  }

  const parts = local.split(/[._-]/);
  if (parts.length >= 2) {
    const first = parts[0]?.[0];
    const second = parts[1]?.[0];
    if (first && second) {
      const result = (first + second).toUpperCase();
      if (/^[A-Z]{2}$/.test(result)) {
        return result;
      }
    }
    return null;
  }

  if (local.length >= 2) {
    const result = local.slice(0, 2).toUpperCase();
    if (/^[A-Z]{2}$/.test(result)) {
      return result;
    }
  }

  if (local.length === 1) {
    const result = local.toUpperCase();
    if (/^[A-Z]$/.test(result)) {
      return result;
    }
  }

  return null;
}
