"use client";

import { useEffect, useRef } from "react";

/**
 * Run an async loader once on mount, then every `ms` milliseconds.
 *
 * The initial run is scheduled in a microtask rather than called inline, so the
 * loader's setState calls are never synchronous inside the effect body. That
 * keeps `react-hooks/set-state-in-effect` clean and avoids a cascading render
 * on mount. Pass `ms = null` to run on mount only (no polling).
 *
 * The latest `fn` is always used without re-subscribing, so callers can pass an
 * inline closure or a `useCallback` whose deps change without restarting the
 * interval.
 */
export function usePolling(
  fn: () => Promise<unknown> | unknown,
  ms: number | null,
) {
  const fnRef = useRef(fn);

  useEffect(() => {
    // Ref write inside an effect, not during render: keeps the latest loader
    // without re-subscribing the interval. Runs before the mount microtask
    // below, so the first tick already sees the current closure.
    fnRef.current = fn;
  });

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        await fnRef.current();
      } catch {
        // Loader owns its own error state; a failed poll must not kill the loop.
      }
    };

    // Microtask, not a direct call: keeps loader setState off the effect's
    // synchronous path (see react-hooks/set-state-in-effect).
    const kick = Promise.resolve().then(() => {
      if (alive) void tick();
    });

    if (ms === null) {
      return () => {
        alive = false;
        void kick;
      };
    }

    const iv = setInterval(() => {
      if (alive) void tick();
    }, ms);

    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [ms]);
}
