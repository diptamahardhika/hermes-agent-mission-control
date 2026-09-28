/**
 * Shared number/time formatters for home dashboard panels.
 *
 * Extracted from `src/app/page.tsx` so panels living in their own modules
 * (loaded via `next/dynamic`) can format identically. Behaviour is
 * byte-for-byte the same as the originals that still live in `page.tsx`.
 */

export function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) {
    const k = Math.round(n / 1_000);
    if (k >= 1000) return (n / 1_000_000).toFixed(1) + "M";
    return k + "K";
  }
  return n.toString();
}

export function fmtExact(n: number) { return n.toLocaleString("en-US"); }

export function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  const hrs  = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);
  if (days > 0) return `${days}d ago`;
  if (hrs  > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}
