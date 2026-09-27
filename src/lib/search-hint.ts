"use client";

/**
 * Dismissal state for the sidebar's "press Cmd+K" search hint.
 *
 * Backed by localStorage and read through `useSyncExternalStore` so the server
 * snapshot and the client snapshot can legitimately differ without triggering a
 * hydration mismatch — the server has no localStorage, the client does.
 */

const KEY = "hermy_search_hint_dismissed";

type Listener = () => void;
const listeners = new Set<Listener>();

// In-memory mirror so a dismiss in this tab notifies React immediately, and a
// `storage` event notifies other tabs.
let cachedDismissed: boolean | null = null;

function readStorage(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function getSnapshot(): boolean {
  if (cachedDismissed === null) cachedDismissed = readStorage();
  return cachedDismissed;
}

// Server render: assume not dismissed, matching a first-visit client.
function getServerSnapshot(): boolean {
  return false;
}

function subscribe(cb: Listener): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== KEY) return;
    cachedDismissed = readStorage();
    cb();
  };

  if (listeners.size === 0) {
    window.addEventListener("storage", onStorage);
  }
  listeners.add(cb);

  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
    }
  };
}

/** Permanently hide the search hint and notify every subscriber. */
export function dismissSearchHint(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Private mode / storage disabled: the in-memory value still hides it.
  }
  cachedDismissed = true;
  for (const cb of listeners) cb();
}

/** True when the hint should be shown. */
export function isSearchHintDismissed(): boolean {
  return getSnapshot();
}

/** Bound so callers can pass `subscribe` directly to `useSyncExternalStore`. */
export const subscribeSearchHint = subscribe;
export const searchHintSnapshot = getSnapshot;
export const searchHintServerSnapshot = getServerSnapshot;
