/**
 * Seed DataStore keys that the dashboard expects but are missing after re-clone.
 * These are synthetic baseline values — the bridge will overwrite them with real data on next sync.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function upsert(key: string, data: Record<string, unknown> | unknown[]) {
  await prisma.dataStore.upsert({
    where: { key },
    update: { data: data as any },
    create: { key, data: data as any },
  })
  console.log(`  ✅ ${key}`)
}

async function main() {
  console.log('🌱 Seeding DataStore baseline keys...\n')

  // 1. hermes-cost — baseline token usage (will be overwritten by bridge)
  await upsert('hermes-cost', {
    syncedAt: new Date().toISOString(),
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    sessions: 0,
    toolCalls: 0,
    byModel: [],
  })

  // 2. hermes-cost-history — empty daily history (will grow as bridge syncs)
  await upsert('hermes-cost-history', { days: [] })

  // 3. homelab-monitor — placeholder (bridge populates real values)
  await upsert('homelab-monitor', {
    syncedAt: new Date().toISOString(),
    overview: {
      checked_at: new Date().toISOString(),
      system: null,
      servers: [],
      services: [],
      containers: [],
    },
  })

  // 4. x-account-stats — from .env values
  const xFollowers = parseInt(process.env.X_FOLLOWERS || '0')
  const xHandle = process.env.X_HANDLE || 'diptamahardhika'
  await upsert('x-account-stats', {
    xFollowers,
    xHandle,
    xGoal: 100000,
    updatedAt: new Date().toISOString(),
  })

  // 5. pixel-ideas — empty (will populate from bridge)
  await upsert('pixel-ideas', [])

  // 6. polymarket-pnl — empty (will populate from bridge)
  await upsert('polymarket-pnl', [])

  console.log('\n🎉 Seeded 6 DataStore keys.')
  await prisma.$disconnect()
}

main().catch(e => {
  console.error('Seed failed:', e.message)
  process.exit(1)
})
