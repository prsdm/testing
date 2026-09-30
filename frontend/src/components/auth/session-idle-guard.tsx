"use client";

import { useEffect, useRef } from "react";

const IDLE_RESET_EVENTS = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
  "wheel",
] as const;

/**
 * Ends the Better Auth cookie session after inactivity while the tab is open.
 * Server-side policy still caps absolute lifetime independently.
 */
export function SessionIdleGuard({ timeoutMs }: { timeoutMs: number }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (timeoutMs <= 0) {
      return;
    }

    let cancelled = false;

    const resetTimer = () => {
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = globalThis.setTimeout(() => {
        if (cancelled) {
          return;
        }

        fetch("/api/auth/sign-out", {
          credentials: "include",
          method: "POST",
        }).finally(() => {
          window.location.assign("/login?reason=inactivity");
        });
      }, timeoutMs);
    };

    resetTimer();

    for (const eventName of IDLE_RESET_EVENTS) {
      window.addEventListener(eventName, resetTimer, { passive: true });
    }

    return () => {
      cancelled = true;

      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
      }

      for (const eventName of IDLE_RESET_EVENTS) {
        window.removeEventListener(eventName, resetTimer);
      }
    };
  }, [timeoutMs]);

  return null;
}
