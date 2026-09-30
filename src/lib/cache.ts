/**
 * In-process response cache for API routes.
 *
 * This was previously backed by Redis, but no `REDIS_URL` was configured and
 * nothing was listening on :6379, so every request took the miss path and
 * re-ran the full handler — `/api/home` never once returned `X-Cache: HIT`.
 * The failure was silent because every Redis call was wrapped in a try/catch
 * that returned `null`. For a single-instance dashboard an in-process `Map`
 * gives the same TTL with no external service to keep alive.
 *
 * Trade-off: state is per-process. If this ever runs behind more than one
 * instance, each keeps its own cache and the TTL becomes approximate. At that
 * point move to a shared store.
 */

import { NextRequest, NextResponse } from 'next/server';

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  // Static/semi-static data - 5 minutes
  STATIC: 300,
  // Dynamic data - 1 minute
  DYNAMIC: 60,
  // Very dynamic data - 30 seconds
  VERY_DYNAMIC: 30,
  // Long-term cache - 1 hour
  LONG_TERM: 3600,
  // Short-term cache - 10 seconds
  SHORT: 10,
} as const;

// Cache key prefix for the application
const CACHE_PREFIX = 'hermes:hq:api:';

type CacheEntry = {
  /** The JSON payload plus the headers `withCache` was asked to preserve. */
  data: unknown;
  headers: Record<string, string>;
  expires: number;
};

/**
 * Stored on `globalThis` so a Next.js dev hot-reload — which re-evaluates
 * modules — does not silently start with an empty cache. Same pattern as
 * `lib/prisma.ts` and the previous `lib/redis.ts`.
 */
const globalForCache = globalThis as unknown as {
  __hqCache?: Map<string, CacheEntry>;
};

const store: Map<string, CacheEntry> = (globalForCache.__hqCache ??= new Map());

/**
 * Generate a cache key from the request URL and optional custom suffix
 */
export function generateCacheKey(request: NextRequest, suffix?: string): string {
  const url = new URL(request.url);
  const path = url.pathname;
  const searchParams = url.searchParams.toString();
  const baseKey = `${CACHE_PREFIX}${path}${searchParams ? '?' + searchParams : ''}`;
  return suffix ? `${baseKey}:${suffix}` : baseKey;
}

/**
 * Get a cached response if it has not expired.
 *
 * Expired entries are dropped on read, so the map cannot grow without bound
 * for keys that are never re-requested within their TTL.
 */
export async function getCachedResponse<T>(key: string): Promise<T | null> {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() >= hit.expires) {
    store.delete(key);
    return null;
  }
  return hit as T;
}

/**
 * Set cache with TTL. `data` is the `{ data, headers }` envelope `withCache`
 * builds — the same shape the previous Redis implementation stored.
 */
export async function setCache(
  key: string,
  data: { data: unknown; headers: Record<string, string> },
  ttlSeconds: number
): Promise<void> {
  store.set(key, {
    data: data.data,
    headers: data.headers,
    expires: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Invalidate cache by key pattern
 */
export async function invalidateCache(pattern: string): Promise<number> {
  if (!pattern) {
    const count = store.size;
    store.clear();
    return count;
  }

  // The Redis version matched `${CACHE_PREFIX}${pattern}*`; a Map has no glob,
  // so treat the pattern as a substring of the key. The only caller passes an
  // empty pattern ("clear everything"), handled by the branch above.
  const needle = pattern.startsWith(CACHE_PREFIX)
    ? pattern.slice(CACHE_PREFIX.length)
    : pattern;
  let count = 0;
  for (const key of [...store.keys()]) {
    if (key.includes(needle)) {
      store.delete(key);
      count++;
    }
  }
  return count;
}

/**
 * Invalidate specific cache key
 */
export async function invalidateCacheKey(key: string): Promise<boolean> {
  return store.delete(key);
}

/**
 * Cache middleware factory for API routes
 * Usage: export const GET = withCache(handler, { ttl: CACHE_TTL.DYNAMIC })
 */
export function withCache<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  options: {
    ttl?: number;
    keySuffix?: (request: NextRequest, ...args: T) => string;
    skipCache?: (request: NextRequest) => boolean;
    varyBy?: string[]; // Headers to vary cache by
  } = {}
) {
  const { ttl = CACHE_TTL.DYNAMIC, keySuffix, skipCache, varyBy = [] } = options;

  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    // Skip cache if explicitly requested
    if (skipCache && skipCache(request)) {
      return handler(request, ...args);
    }

    // Skip cache for non-GET requests
    if (request.method !== 'GET') {
      return handler(request, ...args);
    }

    // Generate cache key with optional vary-by headers
    let cacheKey = generateCacheKey(request);
    if (varyBy.length > 0) {
      const varyValues = varyBy.map(h => request.headers.get(h) || '').join(':');
      if (varyValues) cacheKey += `:vary:${varyValues}`;
    }
    if (keySuffix) {
      cacheKey += `:${keySuffix(request, ...args)}`;
    }

    // Try to get cached response
    const cached = await getCachedResponse<{ data: unknown; headers: Record<string, string> }>(cacheKey);
    if (cached) {
      const response = NextResponse.json(cached.data);
      // Add cache headers
      response.headers.set('X-Cache', 'HIT');
      response.headers.set('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);
      // Preserve important headers from cached response
      Object.entries(cached.headers).forEach(([key, value]) => {
        if (key.toLowerCase().startsWith('x-') || key.toLowerCase() === 'content-type') {
          response.headers.set(key, value);
        }
      });
      return response;
    }

    // Execute handler and cache response
    const response = await handler(request, ...args);

    // Only cache successful responses
    if (response.ok) {
      const data = await response.clone().json().catch(() => null);
      if (data) {
        // Capture headers to preserve
        const headersToCache: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          if (key.toLowerCase().startsWith('x-') || key.toLowerCase() === 'content-type') {
            headersToCache[key] = value;
          }
        });
        await setCache(cacheKey, { data, headers: headersToCache }, ttl);
      }
    }

    // Add cache miss header
    response.headers.set('X-Cache', 'MISS');
    response.headers.set('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);

    return response;
  };
}

/**
 * Manual cache invalidation helper for API routes that mutate data
 * Call this after successful mutations to invalidate related caches
 */
export async function invalidateApiCache(patterns: string[]): Promise<void> {
  await Promise.all(patterns.map(p => invalidateCache(p)));
}

/**
 * Higher-order function to add cache invalidation to a mutation handler
 */
export function withCacheInvalidation<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  invalidationPatterns: string[]
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const response = await handler(request, ...args);
    if (response.ok) {
      // Fire and forget cache invalidation
      invalidateApiCache(invalidationPatterns).catch(console.error);
    }
    return response;
  };
}