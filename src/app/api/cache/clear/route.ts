import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { invalidateCache } from '@/lib/cache';

const prisma = new PrismaClient();
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;
const CACHE_KEYS = ['notion_clients_monthly', 'mcf_monthly', 'ltv_monthly'];

interface CacheResult {
  key: string;
  cleared: boolean;
  source: string;
  count?: number;
  error?: string;
}

async function clearAllCaches(): Promise<CacheResult[]> {
  const results: CacheResult[] = [];

  // Clear Prisma DataStore cache keys
  for (const key of CACHE_KEYS) {
    try {
      await prisma.dataStore.delete({ where: { key } });
      results.push({ key, cleared: true, source: 'prisma' });
    } catch {
      results.push({ key, cleared: false, source: 'prisma' });
    }
  }

  // Clear Redis cache (all keys with hermes:hq:api: prefix)
  try {
    const redisCleared = await invalidateCache('');
    results.push({ key: 'redis:all', cleared: redisCleared > 0, source: 'redis', count: redisCleared });
  } catch (error) {
    console.warn('[cache/clear] Redis invalidation failed:', error);
    results.push({ key: 'redis:all', cleared: false, source: 'redis', error: String(error) });
  }

  return results;
}

export async function POST(req: Request) {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== INTERNAL_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const results = await clearAllCaches();
  return NextResponse.json({ results });
}

// Also allow GET with secret query param for convenience
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || req.headers.get('x-internal-secret');
  if (secret !== INTERNAL_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const results = await clearAllCaches();
  return NextResponse.json({ results });
}