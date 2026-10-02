/**
 * Read side of the `/api/agent-proposals?limit=` contract.
 *
 * The route always returns a plain array. When `limit` is passed it returns
 * only the first N rows, and the counts the caller can no longer derive from
 * `array.length` arrive as response headers:
 *
 *   X-Proposals-Total      rows in the whole filtered set (not the page)
 *   X-Proposals-Pending    rows in that set with status === "pending"
 *   X-Proposals-Truncated  "1" when rows were dropped
 *
 * Why headers instead of a `{ items, total, pending }` body: one JSON shape for
 * every caller. `/agents` omits `limit` and keeps receiving the full array, so
 * there is no second type to narrow at the call site and no way for a future
 * caller to get `undefined` where it expected an array.
 *
 * Counts fall back to values derived from the returned array. That fallback is
 * what makes this safe: if a header is missing — an older build, a proxy that
 * strips them, a caller hitting a cached response — the widget degrades to
 * exactly the behaviour it had before `limit` existed, rather than showing
 * wrong counts or an empty panel.
 */

export interface ProposalCounts {
  /** Rows in the full filtered set, regardless of `limit`. */
  total: number;
  /** Of those, how many are still pending. */
  pending: number;
  /** True when the server dropped rows to honour `limit`. */
  truncated: boolean;
}

interface ProposalLike {
  status: string;
}

function headerInt(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build the URL for a proposals fetch. `limit` is only sent when supplied, so
 * callers that need the full history keep the old request byte-for-byte.
 */
export function proposalsUrl(opts: {
  sortBy: string;
  filter: string;
  limit?: number;
}): string {
  const qs = new URLSearchParams({ sortBy: opts.sortBy, filter: opts.filter });
  if (typeof opts.limit === "number" && Number.isInteger(opts.limit) && opts.limit > 0) {
    qs.set("limit", String(opts.limit));
  }
  return `/api/agent-proposals?${qs.toString()}`;
}

/**
 * Read the counts, preferring headers and falling back to the array.
 *
 * Pass the same array the response body was parsed into; the fallback derives
 * total and pending from it, which is exact whenever the server did not
 * truncate.
 */
export function readProposalCounts(
  res: Response,
  rows: ProposalLike[],
): ProposalCounts {
  const total = headerInt(res.headers, "X-Proposals-Total");
  const pending = headerInt(res.headers, "X-Proposals-Pending");

  if (total !== null && pending !== null) {
    return {
      total,
      pending,
      truncated: res.headers.get("X-Proposals-Truncated") === "1",
    };
  }

  // Fallback: no headers. Derive from what we were given. `total` is only
  // correct if the server sent everything, which is what the absent
  // X-Proposals-Truncated header means.
  const derivedPending = rows.filter((p) => p.status === "pending").length;
  return { total: rows.length, pending: derivedPending, truncated: false };
}
