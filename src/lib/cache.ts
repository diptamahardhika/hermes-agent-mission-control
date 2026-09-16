import { NextRequest, NextResponse } from 'next/server';
import { redis, connectRedis } from './redis';

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
 * Get cached response if available
 */
export async function getCachedResponse<T>(key: string): Promise<T | null> {
  try {
    await connectRedis();
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    return null;
  } catch (error) {
    console.warn('[cache] Get failed:', error);
    return null;
  }
}

/**
 * Set cache with TTL
 */
export async function setCache(key: string, data: unknown, ttlSeconds: number): Promise<void> {
  try {
    await connectRedis();
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
  } catch (error) {
    console.warn('[cache] Set failed:', error);
  }
}

/**
 * Invalidate cache by key pattern
 */
export async function invalidateCache(pattern: string): Promise<number> {
  try {
    await connectRedis();
    const keys = await redis.keys(`${CACHE_PREFIX}${pattern}*`);
    if (keys.length > 0) {
      return await redis.del(...keys);
    }
    return 0;
  } catch (error) {
    console.warn('[cache] Invalidate failed:', error);
    return 0;
  }
}

/**
 * Invalidate specific cache key
 */
export async function invalidateCacheKey(key: string): Promise<boolean> {
  try {
    await connectRedis();
    const result = await redis.del(key);
    return result > 0;
  } catch (error) {
    console.warn('[cache] Invalidate key failed:', error);
    return false;
  }
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