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
      // Authenticated /user/repos includes private repos (the public
      // /users/:login/repos endpoint hides them entirely) and sort=pushed
      // reflects actual work, not metadata touches.
      GITHUB_TOKEN
        ? fetch(`https://api.github.com/user/repos?type=owner&sort=pushed&per_page=100`, { headers: headers(), cache: "no-store" })
        : fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=10&type=all`, { headers: headers(), next: { revalidate: 3600 } }),
      GITHUB_TOKEN
        ? fetch(`https://api.github.com/users/${GITHUB_USERNAME}/events?per_page=50`, { headers: headers(), cache: "no-store" })
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
    let lastWorkedRepo = "";
    if (eventsRes.status === "fulfilled" && eventsRes.value && eventsRes.value.ok) {
      const events: any[] = await eventsRes.value.json();

      // Latest "working on" = freshest push or merged PR within 14 days,
      // derived live instead of a static env string. Events arrive
      // newest-first, so the first match is the most recent.
      const workedCutoff = Date.now() - 14 * 86400000;
      for (const ev of events) {
        const t = new Date(ev.created_at).getTime();
        if (!(t >= workedCutoff)) continue;
        const isWork =
          ev.type === "PushEvent" ||
          (ev.type === "PullRequestEvent" && ev.payload?.action === "merged");
        if (isWork) {
          lastWorkedRepo = String(ev.repo?.name || "").split("/").pop() || "";
          break;
        }
      }
      const now = new Date();
      const weekStart = new Date(now.getTime() - 7 * 86400000);
      const monthStart = new Date(now.getTime() - 30 * 86400000);

      let pushesThisWeek = 0;
      let pushesThisMonth = 0;
      const reposThisWeek = new Set<string>();

      const recentEvents: ActivitySummary["recentEvents"] = [];

      // NB: GitHub strips commit details (payload.commits/size) from event
      // payloads, so a PushEvent carries no count — count each push as one.
      for (const ev of events) {
        const createdAt = new Date(ev.created_at);
        const repoName = ev.repo?.name || "";

        if (ev.type === "PushEvent") {
          if (createdAt >= weekStart) {
            pushesThisWeek += 1;
            reposThisWeek.add(repoName);
          }
          if (createdAt >= monthStart) {
            pushesThisMonth += 1;
          }
        }

        // Collect recent notable events
        if (recentEvents.length < 8) {
          const branch =
            typeof ev.payload?.ref === "string"
              ? ev.payload.ref.replace(/^refs\/heads\//, "")
              : "";
          const nCommits = Array.isArray(ev.payload?.commits)
            ? ev.payload.commits.length
            : Number(ev.payload?.size) || 0;
          const prNum = ev.payload?.pull_request?.number;
          const prTitle: string = ev.payload?.pull_request?.title || "";
          const issueNum = ev.payload?.issue?.number;
          const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

          let eventLabel: string | undefined;
          switch (ev.type) {
            case "PushEvent":
              eventLabel = `Pushed${branch ? ` ${branch}` : ""}${nCommits ? ` · ${nCommits} commit${nCommits !== 1 ? "s" : ""}` : ""}`;
              break;
            case "CreateEvent":
              eventLabel = `Created ${ev.payload?.ref_type || "resource"}${branch && ev.payload?.ref_type !== "repository" ? ` ${branch}` : ""}`;
              break;
            case "PullRequestEvent":
              eventLabel = `${cap(ev.payload?.action || "updated")} PR${prNum ? ` #${prNum}` : ""}${prTitle ? ` · ${prTitle}` : ""}`;
              break;
            case "IssuesEvent":
              eventLabel = `${cap(ev.payload?.action || "updated")} issue${issueNum ? ` #${issueNum}` : ""}`;
              break;
            case "ReleaseEvent":
              eventLabel = `Released ${ev.payload?.release?.tag_name || ""}`;
              break;
            case "WatchEvent":
              eventLabel = "Starred";
              break;
            case "ForkEvent":
              eventLabel = "Forked";
              break;
          }

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
        status:
          lastWorkedRepo
            ? `Working on ${lastWorkedRepo}`
            : recentRepos[0]?.name
              ? `Working on ${recentRepos[0].name}`
              : GITHUB_STATUS || null,
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
