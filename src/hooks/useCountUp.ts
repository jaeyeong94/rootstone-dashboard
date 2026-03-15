"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Animate from 0 to target on mount / when target first becomes non-zero.
 * Always restarts from 0 when the component remounts.
 * Small subsequent changes (SWR refresh) update instantly without re-animating.
 */
export function useCountUp(target: number, duration = 1000): number {
  const [current, setCurrent] = useState(0);
  const animatedTo = useRef<number | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    // Skip zero target (still loading)
    if (target === 0) {
      setCurrent(0);
      animatedTo.current = null;
      return;
    }

    // If already animated, apply small updates instantly
    if (animatedTo.current !== null) {
      setCurrent(target);
      animatedTo.current = target;
      return;
    }

    // First non-zero target: animate from 0
    animatedTo.current = target;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(target * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return current;
}
