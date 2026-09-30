/**
 * Slack channel ids look like C…/D…/G…; user ids like U….
 * Search sometimes returns these (or similar opaque tokens) as `name`.
 */
export function isOpaqueSlackChannelLabel(name: string) {
  const value = name.trim();
  if (!value) {
    return true;
  }
  if (/^[CDGU][A-Z0-9]{8,}$/i.test(value)) {
    return true;
  }
  // All-caps alphanumeric blob with no spaces (e.g. UOBBYNLASTX).
  if (/^[A-Z0-9]{9,}$/.test(value) && !/[a-z]/.test(value)) {
    return true;
  }
  return false;
}

export function buildSlackFederatedTitle(args: {
  channelName?: string;
  userName?: string;
  text: string;
  isIm?: boolean;
  isMpim?: boolean;
}) {
  const channelName = args.channelName?.trim();
  const userName = args.userName?.trim();
  const hasReadableChannel =
    Boolean(channelName) &&
    !isOpaqueSlackChannelLabel(channelName ?? "") &&
    !args.isIm &&
    !args.isMpim;

  // Public/private channels: #name
  if (hasReadableChannel && channelName) {
    return channelName.startsWith("#") ? channelName : `#${channelName}`;
  }

  // DMs / group DMs / opaque channels: author name only (snippet carries the body).
  if (userName) {
    return userName;
  }

  if (args.isIm) {
    return "Slack DM";
  }
  if (args.isMpim) {
    return "Group DM";
  }

  return "Slack message";
}
