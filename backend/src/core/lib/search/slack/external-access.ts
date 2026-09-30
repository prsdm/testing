import { prefixUserEmail } from "@/core/lib/search/acl";

const MAX_SLACK_ACL_EMAILS = 500;

/**
 * Fail-closed Slack ACL: only explicit member emails.
 * Never stamp tenant: or PUBLIC — Slack visibility is channel membership.
 */
export function buildSlackChannelAccessControlList(memberEmails: string[]) {
  const acl = new Set<string>();
  for (const email of memberEmails) {
    const normalized = email.trim().toLowerCase();
    if (!normalized?.includes("@")) {
      continue;
    }
    acl.add(prefixUserEmail(normalized));
    if (acl.size >= MAX_SLACK_ACL_EMAILS) {
      break;
    }
  }
  return [...acl];
}

export function slackMessageDocumentId(channelId: string, ts: string) {
  return `slack:${channelId.trim()}:${ts.trim()}`;
}
