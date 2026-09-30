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
