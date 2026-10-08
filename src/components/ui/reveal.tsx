"use client";

/* ───────────────────────────────────────────────────────────
   Scroll reveal — panels animate as they enter the viewport.

   Why this exists: the dashboard's entrance animations all fire
   on mount (rise(i) = i * 60ms, hq-rise 0.5s). Everything below
   the fold finished animating before you scrolled to it, so
   scrolling revealed panels already sitting at their final state.

   Design (safer default):
   - Anything already intersecting on mount reveals immediately.
     Only genuinely-below-the-fold content waits.
   - The hidden state is applied by JS (a class), never by the
     server-rendered markup. No JS => content is simply visible
     rather than stuck at opacity 0.

   Two things this had to get right, both verified at runtime:

   1. The app does not scroll the window — <main> in
      conditional-layout.tsx is the scroll container
      (overflow-auto, flex-1). Observing/listening on window
      therefore never fires. We find the real scroll root and
      use it as the IntersectionObserver root.

   2. IntersectionObserver can silently deliver zero callbacks
      (observed in this project's headless Chromium: 0 hits even
      for an element already in the viewport). A passive
      scroll/resize check on the same container is the safety
      net, so panels can never be left invisible.
   ─────────────────────────────────────────────────────────── */

import { useEffect, useRef, type ReactNode } from "react";

/** The nearest scrollable ancestor, or null when the page scrolls. */
function scrollRoot(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if (oy === "auto" || oy === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  /** Stagger in ms, matching the existing rise() cadence. */
  delay?: number;
  as?: "div" | "section" | "li";
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const show = () => el.classList.add("is-visible");

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      show();
      return;
    }

    const root = scrollRoot(el);

    const inView = () => {
      const r = el.getBoundingClientRect();
      const limit = root
        ? root.getBoundingClientRect().bottom
        : window.innerHeight;
      return r.top < limit && r.bottom > 0;
    };

    // Already on screen (or scrolled past) — reveal now rather than
    // wait for a scroll that may never come.
    if (inView()) {
      show();
      return;
    }

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              show();
              return;
            }
          }
        },
        { root, rootMargin: "0px 0px -12% 0px", threshold: 0.01 },
      );
      io.observe(el);
    }

    // Safety net: same check on scroll/resize of the real container.
    // rAF-throttled so this stays cheap while scrolling.
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (inView()) show();
      });
    };
    const target: HTMLElement | Window = root ?? window;
    target.addEventListener("scroll", onScroll, { passive: true } as never);
    window.addEventListener("resize", onScroll);

    return () => {
      io?.disconnect();
      target.removeEventListener("scroll", onScroll, { passive: true } as never);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`reveal${className ? ` ${className}` : ""}`}
      style={
        delay
          ? ({ animationDelay: `${delay}ms` } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </Tag>
  );
}