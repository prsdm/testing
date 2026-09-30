export const DEFAULT_COMPOSER_ASSISTANT_NAME = "Kimiro";
export const DEFAULT_COMPOSER_ASSISTANT_SLUG = "kimiro";

export const ASSISTANT_ICON_COLORS = [
  "black",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
] as const;

export type AssistantIconColor = (typeof ASSISTANT_ICON_COLORS)[number];

export const KIMIRO_ASSISTANT_ICON_COLOR: AssistantIconColor = "black";

export const assistantIconColorClasses: Record<
  AssistantIconColor,
  { stroke: string; iconBackground: string }
> = {
  black: {
    iconBackground: "bg-neutral-900/10 dark:bg-neutral-100/10",
    stroke: "text-neutral-900 dark:text-neutral-100",
  },
  blue: {
    iconBackground: "bg-blue-500/10",
    stroke: "text-blue-500",
  },
  green: {
    iconBackground: "bg-green-500/10",
    stroke: "text-green-500",
  },
  orange: {
    iconBackground: "bg-orange-500/10",
    stroke: "text-orange-500",
  },
  purple: {
    iconBackground: "bg-purple-500/10",
    stroke: "text-purple-500",
  },
  yellow: {
    iconBackground: "bg-yellow-400/10",
    stroke: "text-yellow-500",
  },
};

const assistantIconColorSet = new Set<string>(ASSISTANT_ICON_COLORS);

export function resolveDisplayIconColor(
  iconColor: string | null | undefined
): AssistantIconColor {
  if (iconColor && assistantIconColorSet.has(iconColor)) {
    return iconColor as AssistantIconColor;
  }
  return "blue";
}
