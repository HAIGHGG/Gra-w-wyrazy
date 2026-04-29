import { useCallback, useEffect, useRef, useState } from "react";

const TYPING_SPEED_IDLE_RESET_MS = 60000;
const TYPING_SPEED_WINDOW_MS = 60000;

function getTypingSpeedState(entries) {
  return {
    wordCount: entries.length,
    wordsPerMinute: entries.length,
  };
}

export function useTypingSpeed() {
  const [entries, setEntries] = useState([]);
  const entriesRef = useRef([]);
  const resetTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const reset = useCallback(() => {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = null;
    entriesRef.current = [];
    setEntries([]);
  }, []);

  const record = useCallback(() => {
    const now = Date.now();
    const nextEntries = [
      ...entriesRef.current.filter((entryTime) => now - entryTime < TYPING_SPEED_WINDOW_MS),
      now,
    ];

    entriesRef.current = nextEntries;
    setEntries(nextEntries);

    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(reset, TYPING_SPEED_IDLE_RESET_MS);

    return getTypingSpeedState(nextEntries);
  }, [reset]);

  return {
    speed: getTypingSpeedState(entries),
    record,
    reset,
  };
}
