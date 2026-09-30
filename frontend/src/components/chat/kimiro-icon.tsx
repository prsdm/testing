import {
  AssistantCloudMark,
  KimiroLogoTile,
} from "@/components/chat/sidebar-app-logo";
import {
  assistantIconColorClasses,
  resolveDisplayIconColor,
} from "@/shared/chat/assistant-brand";
import { cn } from "@/shared/utils";

type IconTileSize = "xs" | "sm" | "md" | "lg";

/** Size only — corner radius comes from UserAvatar / xs Kimiro tile. */
export const MESSAGE_HEADER_TILE_CLASS = "size-6 shrink-0";

const iconTileSizeClasses: Record<
  IconTileSize,
  { tile: string; icon: string }
> = {
  lg: { icon: "size-5", tile: "size-12 rounded-xl" },
  md: { icon: "size-5", tile: "size-10 rounded-xl" },
  sm: { icon: "size-4", tile: "size-7 rounded-lg" },
  xs: { icon: "size-3.5", tile: "size-6 rounded-[5px]" },
};

type AssistantIconProps = {
  className?: string;
  iconColor?: string | null;
};

/** Non-Kimiro agents (colored cloud glyph, no app square). */
export function AssistantIcon({ className, iconColor }: AssistantIconProps) {
  const resolvedColor = resolveDisplayIconColor(iconColor);
  const strokeClass = assistantIconColorClasses[resolvedColor].stroke;

  return <AssistantCloudMark className={cn(strokeClass, className)} />;
}

export function AssistantIconTile({
  className,
  iconColor,
  size = "sm",
}: {
  className?: string;
  iconColor?: string | null;
  size?: IconTileSize;
}) {
  const resolvedColor = resolveDisplayIconColor(iconColor);
  const backgroundClass =
    assistantIconColorClasses[resolvedColor].iconBackground;
  const sizeClass = iconTileSizeClasses[size];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        sizeClass.tile,
        backgroundClass,
        className
      )}
    >
      <AssistantIcon className={sizeClass.icon} iconColor={iconColor} />
    </div>
  );
}

export function KimiroIconTile({
  className,
  size = "sm",
}: {
  className?: string;
  size?: IconTileSize;
}) {
  const sizeClass = iconTileSizeClasses[size];

  return <KimiroLogoTile className={cn(sizeClass.tile, className)} />;
}

export function KimiroBrandIcon({ className }: { className?: string }) {
  return <KimiroLogoTile className={cn("size-4 rounded-[4px]", className)} />;
}
