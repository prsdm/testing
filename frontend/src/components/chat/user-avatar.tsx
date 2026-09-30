"use client";

import { UserIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import {
  getUserAvatarFallbackColor,
  userAvatarColorSeed,
} from "@/shared/user-avatar-colors";
import { getUserDisplayName } from "@/shared/user-display";
import { cn } from "@/shared/utils";

export function userNavLabel(args: {
  name?: string | null;
  email?: string | null;
}) {
  return getUserDisplayName(args);
}

type UserAvatarProps = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  /** Stable id for fallback color when email is missing (e.g. auth user id). */
  userId?: string | null;
  className?: string;
  priority?: boolean;
  size?: "xs" | "sm" | "nav" | "md" | "lg";
};

const sizePixels = {
  lg: 64,
  md: 48,
  nav: 28,
  sm: 24,
  xs: 20,
} as const;

const sizeClassName = {
  lg: "size-16",
  md: "size-12",
  nav: "size-7",
  sm: "size-6",
  xs: "size-5",
} as const;

/** Profile / large tiles (`size="md"` | `lg`). */
export const USER_AVATAR_SHAPE_CLASS = "rounded-lg";

/** ~8/48 corner ratio so small chat tiles don’t look like circles. */
function userAvatarShapeClass(size: keyof typeof sizeClassName): string {
  switch (size) {
    case "lg":
    case "md":
      return USER_AVATAR_SHAPE_CLASS;
    case "nav":
      return "rounded-[6px]";
    case "sm":
      return "rounded-[5px]";
    default:
      return "rounded-[4px]";
  }
}

function isRenderableImageUrl(url: string) {
  return (
    url.startsWith("blob:") ||
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("/")
  );
}

function UserAvatarFallback({
  ariaLabel,
  className,
  email,
  name,
  pixelSize,
  size,
  userId,
}: {
  ariaLabel: string;
  className?: string;
  email?: string | null;
  name?: string | null;
  pixelSize: number;
  size: keyof typeof sizeClassName;
  userId?: string | null;
}) {
  const backgroundColor = getUserAvatarFallbackColor(
    userAvatarColorSeed({ email, name, userId })
  );

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "flex shrink-0 items-center justify-center ring-1 ring-black/10 ring-inset",
        userAvatarShapeClass(size),
        sizeClassName[size],
        className
      )}
      role="img"
      style={{ backgroundColor }}
    >
      <UserIcon
        aria-hidden
        className="text-white"
        size={Math.round(pixelSize * 0.58)}
        strokeWidth={2.25}
      />
    </div>
  );
}

export function UserAvatar({
  name,
  email,
  image,
  userId,
  className,
  priority = false,
  size = "sm",
}: UserAvatarProps) {
  const resolvedEmail = email?.trim() || undefined;
  const pixelSize = sizePixels[size];
  const ariaLabel = `${getUserDisplayName({ email: resolvedEmail, name })} avatar`;
  const imageUrl =
    image?.trim() && isRenderableImageUrl(image.trim()) ? image.trim() : null;
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const imageFailed = imageUrl !== null && failedImageUrl === imageUrl;

  if (imageUrl && !imageFailed) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden ring-1 ring-sidebar-border/50",
          userAvatarShapeClass(size),
          sizeClassName[size],
          className
        )}
      >
        <Image
          alt=""
          aria-hidden
          className="object-cover"
          fill
          onError={() => setFailedImageUrl(imageUrl)}
          priority={priority}
          sizes={`${pixelSize}px`}
          src={imageUrl}
          unoptimized
        />
      </div>
    );
  }

  return (
    <UserAvatarFallback
      ariaLabel={ariaLabel}
      className={className}
      email={resolvedEmail}
      name={name}
      pixelSize={pixelSize}
      size={size}
      userId={userId}
    />
  );
}
