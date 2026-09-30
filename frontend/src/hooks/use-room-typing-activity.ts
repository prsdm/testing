"use client";

import { useEffect, useRef } from "react";

const TYPING_PULSE_MS = 3000;

export function useRoomTypingActivity(args: {
  enabled: boolean;
  input: string;
  sendRoomTypingSignal: (
    active: boolean,
    threadRootMessageId?: string | null
  ) => void;
  threadRootMessageId?: string | null;
}) {
  const sendRef = useRef(args.sendRoomTypingSignal);
  sendRef.current = args.sendRoomTypingSignal;

  const threadRef = useRef(args.threadRootMessageId ?? null);
  threadRef.current = args.threadRootMessageId ?? null;

  useEffect(() => {
    if (!args.enabled) {
      return;
    }

    const trimmed = args.input.trim();
    if (!trimmed) {
      sendRef.current(false, threadRef.current);
      return;
    }

    sendRef.current(true, threadRef.current);
    const interval = setInterval(() => {
      sendRef.current(true, threadRef.current);
    }, TYPING_PULSE_MS);

    return () => {
      clearInterval(interval);
      sendRef.current(false, threadRef.current);
    };
  }, [args.enabled, args.input]);
}
