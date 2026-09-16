import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis = globalForRedis.redis ?? new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) return null; // Stop retrying after 3 attempts
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
  // Connection pool settings for serverless
  family: 4,
  connectTimeout: 10000,
});

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await redis.quit();
  });
}

export async function connectRedis(): Promise<void> {
  if (redis.status === 'wait' || redis.status === 'end') {
    await redis.connect();
  }
}

export function getRedis(): Redis {
  return redis;
}