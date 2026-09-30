import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CHARS_PER_FRAME = 3;
const CATCHUP_FRAMES = 30;

export type UseTypewriterResult = {
  displayed: string;
  /** True while text is still revealing (including post-finish drain). */
  isActive: boolean;
};

/** Reveal streamed text smoothly when tokens arrive in bursts (Craft-style). */
export function useTypewriter(
  target: string,
  enabled: boolean,
  streamFinished = false
): UseTypewriterResult {
  const targetRef = useRef(target);
  targetRef.current = target;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const streamFinishedRef = useRef(streamFinished);
  streamFinishedRef.current = streamFinished;

  const drainStepRef = useRef<number | null>(null);
  const [displayedLength, setDisplayedLength] = useState(() =>
    enabled ? 0 : target.length
  );
  const displayedLengthRef = useRef(displayedLength);

  const syncDisplayedLength = useCallback((next: number) => {
    displayedLengthRef.current = next;
    setDisplayedLength(next);
  }, []);

  const prevTargetLengthRef = useRef(target.length);
  useEffect(() => {
    if (target.length < prevTargetLengthRef.current) {
      syncDisplayedLength(Math.min(displayedLengthRef.current, target.length));
    }
    prevTargetLengthRef.current = target.length;
  }, [target.length, syncDisplayedLength]);

  const rafIdRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const startLoopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const tick = () => {
      const targetLen = targetRef.current.length;
      const prev = displayedLengthRef.current;
      if (prev >= targetLen) {
        runningRef.current = false;
        rafIdRef.current = null;
        drainStepRef.current = null;
        return;
      }

      let charsThisFrame: number;
      if (streamFinishedRef.current || !enabledRef.current) {
        if (drainStepRef.current === null) {
          const initialBacklog = targetLen - prev;
          drainStepRef.current = Math.max(
            CHARS_PER_FRAME,
            Math.ceil(initialBacklog / CATCHUP_FRAMES)
          );
        }
        charsThisFrame = drainStepRef.current;
      } else {
        charsThisFrame = CHARS_PER_FRAME;
      }

      syncDisplayedLength(Math.min(prev + charsThisFrame, targetLen));
      rafIdRef.current = requestAnimationFrame(tick);
    };

    const start = () => {
      if (runningRef.current) {
        return;
      }
      if (
        !enabledRef.current &&
        !streamFinishedRef.current &&
        displayedLengthRef.current >= targetRef.current.length
      ) {
        return;
      }
      if (
        !enabledRef.current &&
        !streamFinishedRef.current &&
        displayedLengthRef.current < targetRef.current.length
      ) {
        syncDisplayedLength(targetRef.current.length);
        return;
      }
      runningRef.current = true;
      rafIdRef.current = requestAnimationFrame(tick);
    };

    startLoopRef.current = start;

    if (displayedLengthRef.current < targetRef.current.length) {
      start();
    }

    return () => {
      runningRef.current = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      startLoopRef.current = null;
    };
  }, [syncDisplayedLength]);

  useEffect(() => {
    if (displayedLengthRef.current < target.length) {
      drainStepRef.current = null;
      startLoopRef.current?.();
    }
  }, [target]);

  useEffect(() => {
    if (
      !enabled &&
      !streamFinished &&
      displayedLengthRef.current < target.length
    ) {
      syncDisplayedLength(target.length);
    }
  }, [enabled, streamFinished, syncDisplayedLength, target]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const targetLen = targetRef.current.length;
        if (displayedLengthRef.current < targetLen) {
          syncDisplayedLength(targetLen);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [syncDisplayedLength]);

  const displayed = useMemo(
    () => target.slice(0, Math.min(displayedLength, target.length)),
    [target, displayedLength]
  );

  return {
    displayed,
    isActive: displayed.length < target.length,
  };
}
