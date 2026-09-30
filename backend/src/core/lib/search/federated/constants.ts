/**
 * Mild source tilt for hybrid RRF (not Onyx query-expansion weights).
 * Keep live connectors near 1.0 — Onyx-style 0.5 Slack sank live hits when
 * only one KB list competed. Slight KB bump favors curated docs without
 * burying Slack/Gmail/Jira.
 */
export const FEDERATED_KB_WEIGHT = 1.15;

/** Live Slack keyword-search list weight. */
export const FEDERATED_SLACK_WEIGHT = 1;

/** Slack DM history — slightly lower (noisier than keyword search). */
export const FEDERATED_SLACK_DM_WEIGHT = 0.9;

/** Live Jira list weight. */
export const FEDERATED_JIRA_WEIGHT = 1;

/** Live Gmail list weight. */
export const FEDERATED_GMAIL_WEIGHT = 1;

/** Live Google Calendar list weight. */
export const FEDERATED_CALENDAR_WEIGHT = 1;

/** Max hits pulled from each live source before merge. */
export const FEDERATED_LIVE_LIMIT = 12;

/**
 * Slack DM history pull when the query names a person. Higher than
 * FEDERATED_LIVE_LIMIT so 1:1 threads are not shallow vs indexed channels.
 */
export const FEDERATED_SLACK_DM_HISTORY_LIMIT = 40;

/** Max documents returned after RRF merge. */
export const FEDERATED_MERGED_LIMIT = 16;

/**
 * After fusion, keep at least this many hits per sourceType when available so
 * Gmail (etc.) cannot occupy the entire merged window.
 */
export const FEDERATED_MIN_PER_SOURCE = 2;
