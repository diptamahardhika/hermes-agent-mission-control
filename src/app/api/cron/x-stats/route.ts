import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

/** Shape of the `x-account-stats` DataStore blob. */
interface XAccountStats {
  xHandle?: string;
  xFollowers?: number;
  xGoal?: number;
  updatedAt?: string;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (!bearerToken) {
    return NextResponse.json({ error: "TWITTER_BEARER_TOKEN not set" }, { status: 500 });
  }

  try {
    const existing = await prisma.dataStore.findUnique({ where: { key: "x-account-stats" } });
    const current = (existing?.data as XAccountStats | null) || {};
    const handle = current.xHandle || "yourhandle";

    const res = await fetch(
      `https://api.twitter.com/2/users/by/username/${handle}?user.fields=public_metrics`,
      { headers: { Authorization: `Bearer ${bearerToken}` }, cache: "no-store" }
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Twitter API error: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    const followers = data.data?.public_metrics?.followers_count;

    if (typeof followers !== "number") {
      return NextResponse.json({ error: "Could not parse follower count", raw: data }, { status: 500 });
    }

    await prisma.dataStore.upsert({
      where: { key: "x-account-stats" },
      update: { data: { ...current, xFollowers: followers, updatedAt: new Date().toISOString() } },
      create: { key: "x-account-stats", data: { xFollowers: followers, xHandle: handle, xGoal: 100000, updatedAt: new Date().toISOString() } },
    });

    return NextResponse.json({ success: true, xFollowers: followers, handle });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
