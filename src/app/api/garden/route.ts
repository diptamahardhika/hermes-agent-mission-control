import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Shared garden blob — stored in the local Postgres DataStore (key: "shared-garden").
// Previously synced via jsonblob.com, which started Cloudflare-blocking the blob (HTTP 403).

const GARDEN_KEY = 'shared-garden';

function emptyBlob() {
  return { version: 1, lastUpdated: new Date().toISOString(), plants: [] };
}

export async function GET() {
  try {
    const row = await prisma.dataStore.findUnique({ where: { key: GARDEN_KEY } });
    if (!row) {
      const blob = emptyBlob();
      await prisma.dataStore.create({ data: { key: GARDEN_KEY, data: blob } });
      return NextResponse.json(blob);
    }
    return NextResponse.json(row.data);
  } catch (e) {
    console.error('Garden GET error:', e);
    return NextResponse.json({ error: 'Garden storage unreachable' }, { status: 502 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || !Array.isArray(body.plants)) {
      return NextResponse.json({ error: 'Expected garden blob with plants array' }, { status: 400 });
    }
    const blob = { ...body, lastUpdated: new Date().toISOString() };
    await prisma.dataStore.upsert({
      where: { key: GARDEN_KEY },
      update: { data: blob },
      create: { key: GARDEN_KEY, data: blob },
    });
    return NextResponse.json(blob);
  } catch (e) {
    console.error('Garden PUT error:', e);
    return NextResponse.json({ error: 'Failed to update garden' }, { status: 500 });
  }
}
