import { useState, useEffect, useRef, useCallback } from "react";

const AUTO_ADVANCE_MS = 6000;

export function useCarousel(totalSlides: number) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const clearAutoAdvance = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  const startAutoAdvance = useCallback(() => {
    clearAutoAdvance();
    startTimeRef.current = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const pct = Math.min(elapsed / AUTO_ADVANCE_MS, 1);
      setProgress(pct);

      if (pct >= 1) {
        setIndex((i) => (i + 1) % totalSlides);
        startTimeRef.current = performance.now();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [clearAutoAdvance, totalSlides]);

  useEffect(() => {
    if (!paused) {
      startAutoAdvance();
    } else {
      clearAutoAdvance();
      setProgress(0);
    }
    return () => clearAutoAdvance();
  }, [paused, startAutoAdvance, clearAutoAdvance]);

  const goTo = useCallback(
    (i: number) => {
      setIndex(i);
      startTimeRef.current = performance.now();
    },
    [startAutoAdvance]
  );

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % totalSlides);
    startTimeRef.current = performance.now();
  }, [totalSlides]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + totalSlides) % totalSlides);
    startTimeRef.current = performance.now();
  }, [totalSlides]);

  return { index, progress, goTo, next, prev, setPaused };
}
