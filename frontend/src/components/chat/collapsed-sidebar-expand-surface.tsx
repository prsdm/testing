"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/shared/utils";

const INTERACTIVE_ROOT_SELECTOR = [
  '[data-slot="sidebar-menu-button"]',
  '[data-slot="sidebar-menu-action"]',
  '[data-slot="sidebar-trigger"]',
  "a[href]",
  "button",
  "input",
  "textarea",
  "select",
].join(",");

function isCollapsedDesktopRailClick(
  state: string,
  isMobile: boolean,
  target: HTMLElement
) {
  if (isMobile || state !== "collapsed") {
    return false;
  }
  return !target.closest(INTERACTIVE_ROOT_SELECTOR);
}

/**
 * Desktop icon-collapsed sidebar: clicks on “empty” rail/padding expand the sidebar,
 * like ChatGPT/OpenAI Web. Interactive controls stay normal via selector checks.
 */
export function CollapsedSidebarExpandSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { state, setOpen, isMobile } = useSidebar();
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) {
      return;
    }

    const listener = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (!isCollapsedDesktopRailClick(state, isMobile, target)) {
        return;
      }
      setOpen(true);
    };

    el.addEventListener("click", listener);
    return () => {
      el.removeEventListener("click", listener);
    };
  }, [state, setOpen, isMobile]);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col bg-sidebar text-sidebar-foreground",
        className
      )}
      ref={surfaceRef}
    >
      {children}
    </div>
  );
}
