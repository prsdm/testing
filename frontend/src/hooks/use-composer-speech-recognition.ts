"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0?: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
}

function joinDictation(base: string, spoken: string) {
  const trimmedSpoken = spoken.trim();
  if (!trimmedSpoken) {
    return base;
  }
  if (!base) {
    return trimmedSpoken;
  }
  if (/\s$/.test(base)) {
    return `${base}${trimmedSpoken}`;
  }
  return `${base} ${trimmedSpoken}`;
}

export function useComposerSpeechRecognition({
  value,
  onChange,
  enabled = true,
}: {
  value: string;
  onChange: Dispatch<SetStateAction<string>>;
  enabled?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sessionIdRef = useRef(0);
  const valueRef = useRef(value);
  const baseTextRef = useRef("");
  const finalTranscriptRef = useRef("");
  const listeningRef = useRef(false);
  const onChangeRef = useRef(onChange);

  valueRef.current = value;
  listeningRef.current = listening;
  onChangeRef.current = onChange;

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  const endSession = useCallback((sessionId: number) => {
    if (sessionIdRef.current !== sessionId) {
      return;
    }
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const confirm = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setListening(false);
      return;
    }
    try {
      recognition.stop();
    } catch {
      sessionIdRef.current += 1;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
      setListening(false);
    }
  }, []);

  const cancel = useCallback(() => {
    onChangeRef.current(baseTextRef.current);
    finalTranscriptRef.current = "";
    sessionIdRef.current += 1;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    setListening(false);
    if (!recognition) {
      return;
    }
    try {
      recognition.abort();
    } catch {
      // ignore
    }
  }, []);

  useEffect(
    () => () => {
      sessionIdRef.current += 1;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (!enabled && listeningRef.current) {
      cancel();
    }
  }, [cancel, enabled]);

  const start = useCallback(() => {
    if (!enabled) {
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    const previous = recognitionRef.current;
    recognitionRef.current = null;
    if (previous) {
      try {
        previous.abort();
      } catch {
        // ignore
      }
    }

    const sessionId = sessionIdRef.current + 1;
    sessionIdRef.current = sessionId;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang =
      typeof navigator === "undefined"
        ? "en-US"
        : navigator.language || "en-US";

    baseTextRef.current = valueRef.current;
    finalTranscriptRef.current = "";

    recognition.onresult = (event) => {
      if (sessionIdRef.current !== sessionId) {
        return;
      }
      let interim = "";
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index++
      ) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? "";
        if (result?.isFinal) {
          finalTranscriptRef.current += transcript;
        } else {
          interim += transcript;
        }
      }

      onChangeRef.current(
        joinDictation(
          baseTextRef.current,
          `${finalTranscriptRef.current}${interim}`
        )
      );
    };

    recognition.onerror = (event) => {
      if (sessionIdRef.current !== sessionId) {
        return;
      }
      if (event.error === "aborted" || event.error === "no-speech") {
        return;
      }
      if (event.error === "not-allowed") {
        toast.error("Microphone permission denied.");
      } else {
        toast.error("Speech recognition failed. Try again.");
      }
      endSession(sessionId);
    };

    recognition.onend = () => {
      endSession(sessionId);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch {
      endSession(sessionId);
      toast.error("Could not start the microphone.");
    }
  }, [enabled, endSession]);

  return {
    cancel,
    confirm,
    listening,
    start,
    supported,
  };
}
