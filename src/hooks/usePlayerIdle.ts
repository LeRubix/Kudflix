import { useState, useEffect, useCallback, useRef } from 'react';

const IDLE_MS = 3000;

/** Controls auto-hide after a few seconds of inactivity unless `keepVisible` is set (paused, menu open, ...). */
export function usePlayerIdle(keepVisible: boolean) {
  const [active, setActive] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poke = useCallback(() => {
    setActive(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setActive(false), IDLE_MS);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActive(false);
  }, []);

  useEffect(() => {
    poke();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [poke]);

  return { controlsVisible: keepVisible || active, poke, hide };
}
