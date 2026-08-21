/**
 * Momentum Score — Weekly Performance Score (last 7 days)
 *
 * Components:
 *   GitHub          50%   — Contributions this week
 *   X Performance   30%   — Weekly tweet views + engagement
 *   Content Output  20%   — Posts made + quality this week
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || "";

async function weeklyGithubContributions() {
  if (!GITHUB_TOKEN || !GITHUB_USERNAME) return null;
  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          query($login: String!) {
            user(login: $login) {
              contributionsCollection {
                contributionCalendar {
                  weeks {
                    contributionDays {
                      date
                      contributionCount
                    }
                  }
                }
              }
            }
          }`,
        variables: { login: GITHUB_USERNAME },
      }),
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const weeks: any[] = json?.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [];
    const since = Date.now() - 7 * 86_400_000;
    let count = 0;
    for (const w of weeks) {
      for (const d of w.contributionDays ?? []) {
        if (new Date(d.date + "T00:00:00Z").getTime() >= since) count += d.contributionCount || 0;
      }
    }
    return count;
  } catch { return null; }
}

export async function GET() {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 86_400_000);

  // ── 1. X Performance (35%) ─────────────────────────────────
  let weeklyViews    = parseInt(process.env.X_WEEKLY_VIEWS || "0");
  let weeklyPosts    = 0;
  let bestTweetViews = parseInt(process.env.X_BEST_TWEET_VIEWS || "0");

  if (weeklyViews === 0 || weeklyPosts === 0) {
    try {
      const drafts = await prisma.draft.findMany({ where: { postedAt: { gte: weekAgo } } });
      weeklyPosts = drafts.length;
      for (const d of drafts) {
        const m = d.metrics as Record<string, unknown> | null;
        const v = typeof m?.views === "number" ? m.views : 0;
        if (weeklyViews === 0) weeklyViews += v;
        if (v > bestTweetViews) bestTweetViews = v;
      }
    } catch { /* Prisma may be unavailable */ }
  } else {
    try {
      weeklyPosts = await prisma.draft.count({ where: { postedAt: { gte: weekAgo } } });
    } catch { weeklyPosts = parseInt(process.env.WEEKLY_POSTS || "3"); }
  }

  const xScore = weeklyViews >= 1_000_000 ? 100
    : weeklyViews >= 500_000  ? 92
    : weeklyViews >= 200_000  ? 82
    : weeklyViews >= 100_000  ? 72
    : weeklyViews >= 50_000   ? 60
    : weeklyViews >= 10_000   ? 45
    : weeklyViews >= 1_000    ? 25
    : 10;

  // ── 2. Trading P&L (dead) ─────────────────────────────────
  const weekPolyPnl = parseFloat(process.env.POLY_WEEK_PNL || "0");
  const weekHlPnl   = parseFloat(process.env.HL_WEEK_PNL   || "0");
  const weekPnl     = weekPolyPnl + weekHlPnl;

  const tradingScore = weekPnl >= 200  ? 100
    : weekPnl >= 100  ? 90
    : weekPnl >= 50   ? 80
    : weekPnl >= 20   ? 72
    : weekPnl >= 5    ? 63
    : weekPnl >= 0    ? 52
    : weekPnl >= -10  ? 42
    : weekPnl >= -30  ? 32
    : weekPnl >= -60  ? 22
    : weekPnl >= -100 ? 12
    : 5;

  // ── 3. Content Output (20%) ───────────────────────────────
  const consistencyScore = weeklyPosts >= 7 ? 100
    : weeklyPosts >= 5 ? 88
    : weeklyPosts >= 3 ? 75
    : weeklyPosts >= 2 ? 62
    : weeklyPosts >= 1 ? 50
    : 10;

  const viralBonus = bestTweetViews >= 1_000_000 ? 12
    : bestTweetViews >= 500_000 ? 8
    : bestTweetViews >= 100_000 ? 4
    : 0;

  const contentScore = Math.min(100, consistencyScore + viralBonus);

  // ── 4. GitHub Contributions (50%) ─────────────────────────
  const weeklyGithub = await weeklyGithubContributions();
  const githubScore = weeklyGithub === null ? 10
    : weeklyGithub >= 100 ? 100
    : weeklyGithub >= 50  ? 90
    : weeklyGithub >= 30  ? 80
    : weeklyGithub >= 15  ? 68
    : weeklyGithub >= 5   ? 50
    : weeklyGithub >= 1   ? 30
    : 10;

  // ── Final score ────────────────────────────────────────────
  const raw   = xScore * 0.30 + contentScore * 0.20 + githubScore * 0.50;
  const score = Math.round(Math.min(100, Math.max(0, raw)));

  const grade = score >= 90 ? "S" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : score >= 50 ? "D" : "F";
  const label = score >= 90 ? "Legendary" : score >= 80 ? "On Fire 🔥" : score >= 70 ? "Crushing It" : score >= 60 ? "Solid" : score >= 50 ? "Building" : "Slow Week";
  const color = score >= 75 ? "emerald" : score >= 55 ? "yellow" : "red";

  return NextResponse.json({
    score, grade, label, color,
    period: "last 7 days",
    components: {
      x:       { score: Math.round(xScore),       weight: 0.30, label: "X Performance",    detail: weeklyViews > 0 ? `${(weeklyViews/1000).toFixed(0)}K views` : "No data" },
      github:  { score: Math.round(githubScore),  weight: 0.50, label: "GitHub Activity",  detail: weeklyGithub === null ? "No token" : `${weeklyGithub} contributions (7d)` },
      content: { score: Math.round(contentScore), weight: 0.20, label: "Content Output",   detail: `${weeklyPosts} posts${bestTweetViews > 100000 ? ` · ${(bestTweetViews/1000000).toFixed(1)}M best` : ""}` },
    },
    inputs: {
      weeklyViews, weeklyPosts, bestTweetViews,
      weekPnl, weekPolyPnl, weekHlPnl,
      weeklyGithub,
    },
    generatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
