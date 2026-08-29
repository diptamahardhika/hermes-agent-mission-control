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
    repoUrl: string;
    created_at: string;
    description?: string;
    labelUrl?: string;
    headSha?: string;
    prNum?: number;
    prUrl?: string;
    commitUrl?: string;
  }>;
}

export async function GET() {
  if (!GITHUB_USERNAME) {
    return NextResponse.json({ error: "GITHUB_USERNAME not set" }, { status: 500 });
  }

  try {
    const [profileRes, pinnedRes, reposRes, eventsRes, commitsRes] = await Promise.allSettled([
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
      fetch(`https://api.github.com/users/${GITHUB_USERNAME}/events?per_page=50`, { headers: headers(), cache: "no-store" }),
      fetch(
        `https://api.github.com/repos/${GITHUB_USERNAME}/hermes-agent-mission-control/commits?per_page=12`,
        { headers: headers(), next: { revalidate: 60 } }
      ),
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

    // ── Activity summary ────────────────────────────────────────────────
    let activity: ActivitySummary | null = null;
    let lastWorkedRepo = "";

    // Fetch repo commits directly for accurate recent-activity display
    // (user events feed is unreliable — it misses some pushes).
    // Also keep fetching user events for aggregate stats.
    const [eventsData, commitsData] = await Promise.allSettled([
      eventsRes.status === "fulfilled" && eventsRes.value?.ok
        ? eventsRes.value.json()
        : Promise.reject("no events"),
      commitsRes.status === "fulfilled" && commitsRes.value?.ok
        ? commitsRes.value.json()
        : Promise.reject("no commits"),
    ]);

    // Aggregate stats from events (covers all repos, reliable counts)
    const events: any[] =
      eventsData.status === "fulfilled" ? eventsData.value : [];
    const commits: any[] =
      commitsData.status === "fulfilled" ? commitsData.value : [];
    void commits;

    if (events.length > 0) {
      // "Working on" = freshest push or merged PR within 14 days
      const workedCutoff = Date.now() - 14 * 86400000;
      for (const ev of events) {
        const t = new Date(ev.created_at).getTime();
        if (!(t >= workedCutoff)) continue;
        const isWork =
          ev.type === "PushEvent" ||
          (ev.type === "PullRequestEvent" && ev.payload?.action === "merged");
        if (isWork) {
          lastWorkedRepo =
            String(ev.repo?.name || "").split("/").pop() || "";
          break;
        }
      }

      const now = new Date();
      const weekStart = new Date(now.getTime() - 7 * 86400000);
      const monthStart = new Date(now.getTime() - 30 * 86400000);
      let pushesThisWeek = 0;
      let pushesThisMonth = 0;
      const reposThisWeek = new Set<string>();

      for (const ev of events) {
        const createdAt = new Date(ev.created_at);
        if (ev.type === "PushEvent") {
          if (createdAt >= weekStart) {
            pushesThisWeek += 1;
            reposThisWeek.add(ev.repo?.name || "");
          }
          if (createdAt >= monthStart) {
            pushesThisMonth += 1;
          }
        }
      }

      const recentEvents: ActivitySummary["recentEvents"] = [];

      if (commits.length > 0) {
        // Build display rows from commits (always accurate, never stale)
        const repoName = `${GITHUB_USERNAME}/hermes-agent-mission-control`;
        const repoUrl = `https://github.com/${repoName}`;

        for (const commit of commits.slice(0, 12)) {
          const sha: string = commit.sha || "";
          const msg: string =
            (commit.commit?.message || "").split("\n")[0] || "";
          const date: string = commit.commit?.author?.date || "";

          recentEvents.push({
            type: "PushEvent",
            repo: repoName,
            repoUrl,
            created_at: date,
            description: `${sha.slice(0, 7)} · ${msg}`,
            labelUrl: `${repoUrl}/commit/${sha}`,
            headSha: sha,
          });
        }

        activity = {
          pushesThisWeek,
          pushesThisMonth,
          reposThisWeek: reposThisWeek.size,
          recentEvents,
        };
      } else {
        // Fallback to events feed if commits API fails
        for (const ev of events) {
          const repoName = ev.repo?.name || "";
          const repoUrl = repoName ? `https://github.com/${repoName}` : "";

          if (recentEvents.length < 12) {
            const branch =
              typeof ev.payload?.ref === "string"
                ? ev.payload.ref.replace(/^refs\/heads\//, "")
                : "";
            const headSha: string | undefined =
              ev.type === "PushEvent" &&
              typeof ev.payload?.head === "string"
                ? ev.payload.head
                : undefined;
            const prNum = ev.payload?.pull_request?.number;
            const prTitle: string =
              ev.payload?.pull_request?.title || "";
            const prHtmlUrl: string | undefined =
              typeof ev.payload?.pull_request?.html_url === "string"
                ? ev.payload.pull_request.html_url
                : undefined;
            const prHeadSha: string | undefined =
              typeof ev.payload?.pull_request?.head?.sha === "string"
                ? ev.payload.pull_request.head.sha
                : undefined;
            const issueNum = ev.payload?.issue?.number;
            const issueHtmlUrl: string | undefined =
              typeof ev.payload?.issue?.html_url === "string"
                ? ev.payload.issue.html_url
                : undefined;
            const releaseTag: string | undefined =
              typeof ev.payload?.release?.tag_name === "string"
                ? ev.payload.release.tag_name
                : undefined;
            const releaseHtmlUrl: string | undefined =
              typeof ev.payload?.release?.html_url === "string"
                ? ev.payload.release.html_url
                : undefined;
            const releaseTarget: string | undefined =
              typeof ev.payload?.release?.target_commitish === "string"
                ? ev.payload.release.target_commitish
                : undefined;
            const cap = (s: string) =>
              s.charAt(0).toUpperCase() + s.slice(1);
            const short = (s: string) => s.slice(0, 7);

            let eventLabel: string | undefined;
            let labelUrl: string | undefined;
            switch (ev.type) {
              case "PushEvent":
                eventLabel = `Pushed${branch ? ` ${branch}` : ""}${headSha ? ` · ${short(headSha)}` : ""}`;
                labelUrl =
                  headSha && repoName
                    ? `${repoUrl}/commit/${headSha}`
                    : undefined;
                break;
              case "CreateEvent":
                if (
                  ev.payload?.ref_type === "branch" &&
                  branch &&
                  repoName
                ) {
                  eventLabel = `Created branch ${branch}`;
                  labelUrl = `${repoUrl}/tree/${branch}`;
                } else if (
                  ev.payload?.ref_type === "tag" &&
                  branch &&
                  repoName
                ) {
                  eventLabel = `Created tag ${branch}`;
                  labelUrl = `${repoUrl}/releases/tag/${branch}`;
                } else if (ev.payload?.ref_type === "repository") {
                  eventLabel = `Created repository ${repoName.split("/").pop() || ""}`;
                  labelUrl = repoUrl || undefined;
                }
                break;
              case "PullRequestEvent":
                eventLabel = `${cap(ev.payload?.action || "updated")} PR${prNum ? ` #${prNum}` : ""}${prHeadSha ? ` · ${short(prHeadSha)}` : ""}${prTitle ? ` · ${prTitle}` : ""}`;
                labelUrl =
                  prHtmlUrl ||
                  (prNum && repoName ? `${repoUrl}/pull/${prNum}` : undefined);
                break;
              case "IssuesEvent":
                eventLabel = `${cap(ev.payload?.action || "updated")} issue${issueNum ? ` #${issueNum}` : ""}`;
                labelUrl =
                  issueHtmlUrl ||
                  (issueNum && repoName
                    ? `${repoUrl}/issues/${issueNum}`
                    : undefined);
                break;
              case "ReleaseEvent":
                eventLabel = `Released ${releaseTag || ""}${releaseTarget ? ` · ${short(releaseTarget)}` : ""}`;
                labelUrl = releaseHtmlUrl;
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
                repoUrl,
                created_at: ev.created_at,
                description: eventLabel,
                labelUrl,
                headSha,
                prNum: prNum || undefined,
                prUrl: prHtmlUrl,
                commitUrl:
                  ev.type === "PushEvent" && headSha && repoName
                    ? `${repoUrl}/commit/${headSha}`
                    : undefined,
              });
            }
          }
        }

        activity = {
          pushesThisWeek,
          pushesThisMonth,
          reposThisWeek: reposThisWeek.size,
          recentEvents: [...recentEvents].reverse(),
        };
      }
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
