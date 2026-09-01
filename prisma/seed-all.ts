/**
 * Combined seed script: DataStore keys + AgentState from kanban.db.
 * Run with: npx tsx prisma/seed-all.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type JsonValue = Record<string, unknown> | unknown[]

async function upsert(key: string, data: JsonValue) {
  await prisma.dataStore.upsert({
    where: { key },
    update: { data: data as any },
    create: { key, data: data as any },
  })
}

async function seedDatastore() {
  console.log('🌱 Seeding DataStore keys...')

  await upsert('hermes-cost', {
    syncedAt: new Date().toISOString(),
    totalTokens: 0, inputTokens: 0, outputTokens: 0,
    sessions: 0, toolCalls: 0, byModel: [],
  })
  console.log('  ✅ hermes-cost')

  await upsert('hermes-cost-history', { days: [] })
  console.log('  ✅ hermes-cost-history')

  await upsert('homelab-monitor', {
    syncedAt: new Date().toISOString(),
    overview: {
      checked_at: new Date().toISOString(),
      system: null, servers: [], services: [], containers: [],
    },
  })
  console.log('  ✅ homelab-monitor')

  const xFollowers = parseInt(process.env.X_FOLLOWERS || '0')
  const xHandle = process.env.X_HANDLE || 'diptamahardhika'
  await upsert('x-account-stats', {
    xFollowers, xHandle, xGoal: 100000,
    updatedAt: new Date().toISOString(),
  })
  console.log('  ✅ x-account-stats')

  await upsert('pixel-ideas', [])
  console.log('  ✅ pixel-ideas')

  await upsert('polymarket-pnl', [])
  console.log('  ✅ polymarket-pnl')
}

async function seedAgentStateFromKanban() {
  console.log('\n🤖 Seeding AgentState from kanban.db...')

  // Agent metadata (name, emoji, role, status)
  const agents = [
    { id: 'max', name: 'Max', emoji: '🐺', role: 'Chief of Staff / Orchestrator' },
    { id: 'sage', name: 'Sage', emoji: '🌿', role: 'AI Research Analyst' },
    { id: 'knox', name: 'Knox', emoji: '🔐', role: 'Security & Infrastructure Engineer' },
    { id: 'nova', name: 'Nova', emoji: '⭐', role: 'UI/UX & Frontend Review Agent' },
    { id: 'pixel', name: 'Pixel', emoji: '🎨', role: 'Repo Hygiene & Visual Polish Agent' },
  ]

  // Query kanban.db via SQLite3 CLI for each agent's stats
  for (const agent of agents) {
    const id = agent.id
    const result = await execSqlite(
      `SELECT COUNT(*) as total, MAX(completed_at) as last_completed, status FROM tasks WHERE assignee='${id}' GROUP BY status ORDER BY completed_at DESC LIMIT 1`
    )
    const totalRow = await execSqlite(`SELECT COUNT(*) as total FROM tasks WHERE assignee='${id}'`) as { total?: string; done?: string; last_completed?: string }
    const doneRow = await execSqlite(`SELECT COUNT(*) as done FROM tasks WHERE assignee='${id}' AND status='done'`) as { total?: string; done?: string; last_completed?: string }

    const total = parseInt((totalRow.total ?? '0') as string)
    const done = parseInt((doneRow.done ?? '0') as string)
    const lastCompleted = totalRow.last_completed ? new Date(totalRow.last_completed as string) : new Date()

    await prisma.agentState.upsert({
      where: { id },
      update: {
        name: agent.name,
        emoji: agent.emoji,
        role: agent.role,
        status: 'idle',
        lastActive: lastCompleted,
        tasksCompleted: done,
        totalCost: 0,
        currentTask: null,
        recentActivity: [],
        updatedAt: new Date(),
      },
      create: {
        id,
        name: agent.name,
        emoji: agent.emoji,
        role: agent.role,
        status: 'idle',
        lastActive: lastCompleted,
        tasksCompleted: done,
        totalCost: 0,
        currentTask: null,
        recentActivity: [],
        updatedAt: new Date(),
      },
    })
    console.log(`  ✅ ${id} — ${done} tasks done`)
  }
}

function execSqlite(query: string): Promise<{ total?: string; done?: string; last_completed?: string }> {
  return new Promise((resolve, reject) => {
    const { execFile } = require('child_process')
    execFile('sqlite3', ['-readonly', '~/.hermes/kanban.db', query], { timeout: 5000 }, (err: Error | null, stdout: string, stderr: string) => {
      if (err) return reject(err)
      try {
        const lines = stdout.trim().split('\n').filter(Boolean)
        const row: Record<string, string> = {}
        for (const line of lines) {
          const parts = line.split('|')
          if (parts.length >= 2) row[parts[0].trim()] = parts[1].trim()
        }
        resolve(row as any)
      } catch (e) { resolve({}) }
    })
  })
}

async function main() {
  await seedDatastore()
  await seedAgentStateFromKanban()
  console.log('\n🎉 Seed complete. Restart the dev server to pick up new DataStore values.')
  await prisma.$disconnect()
}

main().catch(e => { console.error('Seed failed:', e.message); process.exit(1) })
