import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GITHUB_USERNAME = process.env.GITHUB_USERNAME || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_STATUS = process.env.GITHUB_STATUS || "";

function headers() {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
  };
}

function avatarUrl(url: string | null | undefined, size = 120) {
  if (!url) return "";
  return url.replace("{size}", String(size));
}

interface Repo {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  stars: number;
  forks: number;
  language: string | null;
  updatedAt: string;
  isPrivate: boolean;
  createdAt: string;
}

interface Profile {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  twitterUsername: string | null;
  followers: number;
  following: number;
  publicRepos: number;
  publicGists: number;
  createdAt: string;
  updatedAt: string;
  isViewer: boolean;
}

interface ActivitySummary {
  pushesThisWeek: number;
  pushesThisMonth: number;
  reposThisWeek: number;
  recentEvents: Array<{
    type: string;
    repo: string;
    created_at: string;
    description?: string;
  }>;
}

export async function GET() {
  if (!GITHUB_USERNAME) {
    return NextResponse.json({ error: "GITHUB_USERNAME not set" }, { status: 500 });
  }

  try {
    const [profileRes, pinnedRes, reposRes, eventsRes] = await Promise.allSettled([
      fetch(`https://api.github.com/users/${GITHUB_USERNAME}`, { headers: headers(), next: { revalidate: 3600 } }),
      GITHUB_TOKEN
        ? fetch(`https://api.github.com/users/${GITHUB_USERNAME}/pinned/repos?per_page=6`, { headers: headers(), next: { revalidate: 3600 } })
        : Promise.resolve(null),
      fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=10&type=all`, { headers: headers(), next: { revalidate: 3600 } }),
      GITHUB_TOKEN
        ? fetch(`https://api.github.com/users/${GITHUB_USERNAME}/events?per_page=50`, { headers: headers(), next: { revalidate: 600 } })
        : Promise.resolve(null),
    ]);

    // ── Profile ──────────────────────────────────────────────────────
    let profile: Profile | null = null;
    if (profileRes.status === "fulfilled" && profileRes.value.ok) {
      const p = await profileRes.value.json();
      profile = {
        login: p.login,
        name: p.name,
        avatarUrl: avatarUrl(p.avatar_url),
        bio: p.bio,
        company: p.company,
        location: p.location,
        blog: p.blog,
        twitterUsername: p.twitter_username,
        followers: p.followers ?? 0,
        following: p.following ?? 0,
        publicRepos: p.public_repos ?? 0,
        publicGists: p.public_gists ?? 0,
        createdAt: p.created_at || "",
        updatedAt: p.updated_at || "",
        isViewer: false,
      };
    }

    // ── Pinned repos ─────────────────────────────────────────────────
    let pinnedRepos: Repo[] = [];
    if (pinnedRes.status === "fulfilled" && pinnedRes.value && pinnedRes.value.ok) {
      const repos = await pinnedRes.value.json();
      pinnedRepos = repos.map((r: any) => ({
        id: String(r.id),
        name: r.name,
        fullName: r.full_name,
        description: r.description,
        htmlUrl: r.html_url,
        stars: r.stargazers_count ?? 0,
        forks: r.forks_count ?? 0,
        language: r.language,
        updatedAt: r.updated_at || "",
        isPrivate: r.private,
        createdAt: r.created_at || "",
      }));
    }

    // ── Recent repos ─────────────────────────────────────────────────
    let recentRepos: Repo[] = [];
    if (reposRes.status === "fulfilled" && reposRes.value.ok) {
      const repos = await reposRes.value.json();
      recentRepos = repos
        .filter((r: any) => !r.fork) // skip forks for cleaner list
        .slice(0, 10)
        .map((r: any) => ({
          id: String(r.id),
          name: r.name,
          fullName: r.full_name,
          description: r.description,
          htmlUrl: r.html_url,
          stars: r.stargazers_count ?? 0,
          forks: r.forks_count ?? 0,
          language: r.language,
          updatedAt: r.updated_at || "",
          isPrivate: r.private,
          createdAt: r.created_at || "",
        }));
    }

    // ── Activity summary (from public events) ───────────────────────
    let activity: ActivitySummary | null = null;
    if (eventsRes.status === "fulfilled" && eventsRes.value && eventsRes.value.ok) {
      const events: any[] = await eventsRes.value.json();
      const now = new Date();
      const weekStart = new Date(now.getTime() - 7 * 86400000);
      const monthStart = new Date(now.getTime() - 30 * 86400000);

      let pushesThisWeek = 0;
      let pushesThisMonth = 0;
      let reposThisWeek = new Set<string>();

      const recentEvents: ActivitySummary["recentEvents"] = [];

      for (const ev of events) {
        const createdAt = new Date(ev.created_at);
        const repoName = ev.repo?.name || "";
        const commitCount = ev.type === "PushEvent" ? ev.payload?.commits?.length || 0 : 0;

        // Count pushes this week / month
        if (ev.type === "PushEvent") {
          if (createdAt >= weekStart) {
            pushesThisWeek += commitCount;
            reposThisWeek.add(repoName);
          }
          if (createdAt >= monthStart) {
            pushesThisMonth += commitCount;
          }
        }

        // Collect recent notable events
        if (recentEvents.length < 8) {
          const eventLabel = ({
            PushEvent: `Pushed ${commitCount || 1} commit${commitCount !== 1 ? "s" : ""}`,
            CreateEvent: `Created ${ev.payload?.ref_type || "resource"}`,
            PullRequestEvent: `${ev.payload?.action || "PR"} ${ev.payload?.pull_request?.title || ""}`,
            IssuesEvent: `${ev.payload?.action || "issue"}`,
            ReleaseEvent: `Released ${ev.payload?.release?.tag_name || ""}`,
            WatchEvent: "Starred",
            ForkEvent: "Forked",
          } as Record<string, string | undefined>)[ev.type];

          if (eventLabel) {
            recentEvents.push({
              type: ev.type,
              repo: repoName,
              created_at: ev.created_at,
              description: eventLabel,
            });
          }
        }
      }

      activity = {
        pushesThisWeek,
        pushesThisMonth,
        reposThisWeek: reposThisWeek.size,
        recentEvents,
      };
    }

    return NextResponse.json(
      {
        profile,
        pinnedRepos,
        recentRepos,
        activity,
        status: GITHUB_STATUS || null,
        fetchedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store, no-cache" } }
    );
  } catch (err) {
    console.error("[github API] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch GitHub data", detail: String(err) },
      { status: 500 }
    );
  }
}
