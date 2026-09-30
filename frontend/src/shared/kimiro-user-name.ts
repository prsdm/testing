export function resolveKimiroAddressName(args: {
  preferredName?: string | null;
  fullName?: string | null;
}): string | null {
  const preferred = args.preferredName?.trim();
  if (preferred) {
    return preferred;
  }
  const full = args.fullName?.trim();
  if (!full) {
    return null;
  }
  const first = full.split(/\s+/).at(0)?.trim();
  return first || full;
}

/** Name shown on room/channel messages (metadata first, then viewer profile). */
export function resolveRoomMessageAuthorDisplayName(args: {
  metadataAuthorDisplayName?: string | null;
  metadataAuthorEmail?: string | null;
  isOwnMessage: boolean;
  viewerPreferredName?: string | null;
  viewerFullName?: string | null;
  viewerEmail?: string | null;
}): string {
  const stored = args.metadataAuthorDisplayName?.trim();
  if (stored) {
    return stored;
  }
  if (args.isOwnMessage) {
    return (
      resolveKimiroAddressName({
        fullName: args.viewerFullName,
        preferredName: args.viewerPreferredName,
      }) ||
      args.viewerEmail?.trim() ||
      "You"
    );
  }
  return args.metadataAuthorEmail?.trim() || "Member";
}
