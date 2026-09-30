/** Teams-style accent — @mentions and thread reply links. */
export const CHAT_ACCENT_LIGHT = "#6264A7";
export const CHAT_ACCENT_DARK = "#8B8CC7";

const chatAccentTextClass = "text-[#6264A7] dark:text-[#8B8CC7]";

/** @mention in sent messages (Teams purple). */
export const CHAT_MENTION_TEXT_CLASS = `font-semibold ${chatAccentTextClass}`;

export const CHAT_MENTION_HIGHLIGHT_CLASS = CHAT_MENTION_TEXT_CLASS;

/** Thread reply count / open-thread control. */
export const CHAT_THREAD_REPLY_LINK_CLASS = chatAccentTextClass;

/** Peer / other member user bubbles (left). */
export const USER_PEER_MESSAGE_BUBBLE_CLASS =
  "w-fit rounded-lg bg-[#e9e9e980] px-3 py-2 dark:bg-[#2f2f2f]";

/** Your messages (right) — same neutral grey as peer bubbles. */
export const USER_OWN_MESSAGE_BUBBLE_CLASS =
  "w-fit rounded-lg bg-[#e9e9e980] px-3 py-2 dark:bg-[#2f2f2f]";

/**
 * Composer mirror @mentions — color only (no pill padding / semibold) so the caret
 * stays aligned; sent messages use {@link CHAT_MENTION_TEXT_CLASS}.
 */
export const CHAT_MENTION_COMPOSER_MIRROR_CLASS = `${chatAccentTextClass} [text-shadow:0.018em_0_currentColor,-0.018em_0_currentColor]`;

/** Slack-style reaction pills — paired light/dark (not theme `primary`, which is grayscale). */
export const MESSAGE_REACTION_CHIP_INACTIVE_CLASS =
  "border-border/60 bg-[#f3f3f3] hover:bg-[#ebebeb] dark:border-[#404040] dark:bg-[#2f2f2f] dark:hover:bg-[#383838]";

export const CHAT_REACTION_ACTIVE_SURFACE_CLASS =
  "border-[#6264A7]/45 bg-[#F2F3FC] dark:border-[#8B8CC7]/50 dark:bg-[color-mix(in_srgb,#6264A7_18%,rgb(23_23_23))]";

export const MESSAGE_REACTION_CHIP_ACTIVE_CLASS = `${CHAT_REACTION_ACTIVE_SURFACE_CLASS} hover:bg-[#E8EBFA] dark:hover:bg-[color-mix(in_srgb,#6264A7_24%,rgb(23_23_23))]`;

/** Selected thread row in channel inbox list. */
export const CHANNEL_TOPIC_THREAD_ACTIVE_CLASS = "bg-muted/50";
