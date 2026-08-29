"use client";

import { Github, Star, GitBranch, Calendar, Globe, ArrowUpRight, GitCommit, FolderGit2 } from "lucide-react";
import { useEffect, useState } from "react";

interface GitHubProfile {
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

interface GitHubData {
  profile: GitHubProfile | null;
  pinnedRepos: Repo[];
  recentRepos: Repo[];
  activity: ActivitySummary | null;
  status: string | null;
  fetchedAt: string;
}

const EMPTY: GitHubData = {
  profile: null,
  pinnedRepos: [],
  recentRepos: [],
  activity: null,
  status: null,
  fetchedAt: "",
};

function timeAgo(d: string) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 90) return `${Math.floor(days / 30)}mo ago`;
  if (days > 30) return ">1mo ago";
  if (days > 0) return `${days}d ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs > 0) return `${hrs}h ago`;
  return "just now";
}

function fmt(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function langBadge(lang: string | null) {
  if (!lang) return null;
  const colors: Record<string, string> = {
    TypeScript: "bg-blue-500/20 text-blue-300 border-blue-500/20",
    JavaScript: "bg-yellow-500/20 text-yellow-300 border-yellow-500/20",
    Python: "bg-green-500/20 text-green-300 border-green-500/20",
    Go: "bg-cyan-500/20 text-cyan-300 border-cyan-500/20",
    Rust: "bg-orange-500/20 text-orange-300 border-orange-500/20",
    Java: "bg-red-500/20 text-red-300 border-red-500/20",
    C: "bg-blue-700/20 text-blue-200 border-blue-700/20",
    "C++": "bg/blue-600/20 text-blue-200 border-blue-600/20",
    Kotlin: "bg-purple-500/20 text-purple-300 border-purple-500/20",
    Swift: "bg-orange-400/20 text-orange-300 border-orange-400/20",
    Dart: "bg-cyan-600/20 text-cyan-200 border-cyan-600/20",
    Shell: "bg-gray-500/20 text-gray-300 border-gray-500/20",
    Dockerfile: "bg-gray-600/20 text-gray-300 border-gray-600/20",
    Vue: "bg-green-600/20 text-green-300 border-green-600/20",
    CSS: "bg-pink-500/20 text-pink-300 border-pink-500/20",
    HTML: "bg-orange-600/20 text-orange-300 border-orange-600/20",
  };
  const cls = colors[lang] || "bg-gray-500/20 text-gray-300 border-gray-500/20";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${cls}`}>
      {lang}
    </span>
  );
}

function RepoCard({ repo, compact = false }: { repo: Repo; compact?: boolean }) {
  return (
    <a
      href={repo.htmlUrl}
      target="_blank"
      rel="noreferrer"
      className={`group flex items-start gap-3 rounded-lg border border-[var(--hq-hairline)] bg-white/[0.02] p-3 transition-all hover:bg-white/[0.04] hover:border-[var(--hq-text-faint)] ${compact ? "py-2" : ""}`}
    >
      <div className="w-10 h-10 rounded-lg bg-[var(--surface-1)] flex items-center justify-center shrink-0 overflow-hidden">
        <FolderGit2 className="w-5 h-5 text-[var(--hq-text-ghost)]" />
      </div>
      <div className={`flex-1 min-w-0 ${compact ? "py-0.5" : ""}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-[var(--hq-text)] group-hover:text-[var(--accent)] transition-colors truncate">
            {repo.name}
            {repo.isPrivate && (
              <span className="text-[10px] px-1 py-0.5 rounded-full bg-amber-500/10 text-amber-400/80 border border-amber-500/20 ml-1">
                private
              </span>
            )}
          </span>
          <div className="ml-auto flex gap-1.5 items-center">
            <span className="num text-[11px] text-[var(--hq-text-ghost)] flex items-center gap-1">
              <Star className="w-3 h-3" style={{ color: "#f0b132" }} />
              {repo.stars}
            </span>
            <span className="num text-[11px] text-[var(--hq-text-ghost)] flex items-center gap-1">
              <GitBranch className="w-3 h-3" />
              {repo.forks}
            </span>
          </div>
        </div>
        {repo.description && !compact && (
          <p className="text-[12px] text-[var(--hq-text-dim)] mt-1 leading-snug line-clamp-2">
            {repo.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {langBadge(repo.language)}
          <span className="text-[10.5px] text-[var(--hq-text-ghost)] num">
            updated {timeAgo(repo.updatedAt)}
          </span>
        </div>
      </div>
      <ArrowUpRight className="w-3.5 h-3.5 text-[var(--hq-text-ghost)] group-hover:text-[var(--hq-text-dim)] shrink-0 mt-1 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </a>
  );
}

export default function GitHubPage() {
  const [data, setData] = useState<GitHubData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/github")
      .then((r) => r.ok ? r.json() : Promise.reject("fetch failed"))
      .then((d) => {
        if (d?.profile) {
          setData(d as GitHubData);
          setError(null);
        } else {
          setError(d?.error || "No data returned");
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));

    const iv = setInterval(() => {
      fetch("/api/github")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d?.profile) setData(d as GitHubData); })
        .catch(() => {});
    }, 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-[var(--hq-hairline)] border-t-[var(--accent)] rounded-full animate-spin mb-4" />
        <p className="text-[var(--hq-text-ghost)] text-[13px]">Loading GitHub data...</p>
      </div>
    );
  }

  if (error || !data.profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Github className="w-10 h-10 text-[var(--hq-text-ghost)] mb-4" />
        <p className="text-[var(--hq-text-dim)] text-[13px]">{error || "Unable to load GitHub profile"}</p>
        <p className="text-[var(--hq-text-ghost)] text-[11px] mt-2">Check that GITHUB_USERNAME is set in .env</p>
      </div>
    );
  }

  const p = data.profile;

  return (
    <div className="mx-auto max-w-5xl">
      {/* ── Profile hero ─────────────────────────────────────── */}
      <div className="panel p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
          {/* Avatar */}
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.avatarUrl}
              alt={p.login}
              className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-[var(--hq-hairline)] object-cover"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[var(--accent)] border-2 border-[var(--bg)] flex items-center justify-center">
              <Github className="w-3 h-3 text-[var(--bg)]" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-[24px] font-bold text-[var(--hq-text)]">
                {p.name || p.login}
              </h2>
              <span className="text-[var(--hq-text-ghost)] text-[13px]">@{p.login}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 font-medium">
                You
              </span>
            </div>

            {p.bio && (
              <p className="text-[13px] text-[var(--hq-text-dim)] mt-2 leading-relaxed max-w-2xl">
                {p.bio}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[12px] text-[var(--hq-text-ghost)]">
              {p.company && (
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3 h-3" />
                  {p.company}
                </span>
              )}
              {p.location && (
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3 h-3" />
                  {p.location}
                </span>
              )}
              {p.blog && (
                <a href={p.blog.startsWith("http") ? p.blog : `https://${p.blog}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-[var(--hq-text)] transition-colors">
                  <Globe className="w-3 h-3" />
                  {p.blog.includes("://") ? new URL(p.blog).hostname : p.blog}
                </a>
              )}
              {p.twitterUsername && (
                <a href={`https://twitter.com/${p.twitterUsername}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-[var(--hq-text)] transition-colors">
                  <Globe className="w-3 h-3" />
                  @{p.twitterUsername}
                </a>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 shrink-0 ml-0 md:ml-auto">
            <div className="text-center rounded-lg border border-[var(--hq-hairline)] bg-white/[0.02] p-2.5">
              <div className="num text-[22px] font-semibold text-[var(--hq-text)]">{fmt(p.publicRepos)}</div>
              <div className="text-[10.5px] text-[var(--hq-text-ghost)]">Repos</div>
            </div>
            <div className="text-center rounded-lg border border-[var(--hq-hairline)] bg-white/[0.02] p-2.5">
              <div className="num text-[22px] font-semibold text-[var(--hq-text)]">{fmt(p.followers)}</div>
              <div className="text-[10.5px] text-[var(--hq-text-ghost)]">Followers</div>
            </div>
            <div className="text-center rounded-lg border border-[var(--hq-hairline)] bg-white/[0.02] p-2.5">
              <div className="num text-[22px] font-semibold text-[var(--hq-text)]">{fmt(p.following)}</div>
              <div className="text-[10.5px] text-[var(--hq-text-ghost)]">Following</div>
            </div>
          </div>
        </div>

        {/* Status bar */}
        {data.status && (
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-3 py-2">
            <div className="relative flex w-2 h-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] animate-ping opacity-50" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-[var(--accent)]" />
            </div>
            <span className="text-[12.5px] text-[var(--hq-text-dim)]">{data.status}</span>
          </div>
        )}

        {/* Account age */}
        {p.createdAt && (
          <div className="mt-4 flex items-center gap-2 text-[11px] text-[var(--hq-text-ghost)]">
            <Calendar className="w-3.5 h-3.5" />
            Joined {new Date(p.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
        )}
      </div>

      {/* ── Activity summary ─────────────────────────────────── */}
      {data.activity && (
        <div className="mt-4 panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <GitCommit className="w-4 h-4" style={{ color: "var(--accent)" }} />
            <span className="eyebrow">Recent Activity</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className="rounded-lg border border-[var(--hq-hairline)] bg-white/[0.02] p-3 text-center">
              <div className="num text-[20px] font-semibold text-[var(--accent)]">{data.activity.pushesThisWeek}</div>
              <div className="text-[10.5px] text-[var(--hq-text-ghost)] mt-0.5">Pushes (7d)</div>
            </div>
            <div className="rounded-lg border border-[var(--hq-hairline)] bg-white/[0.02] p-3 text-center">
              <div className="num text-[20px] font-semibold text-[var(--accent)]">{data.activity.pushesThisMonth}</div>
              <div className="text-[10.5px] text-[var(--hq-text-ghost)] mt-0.5">Pushes (30d)</div>
            </div>
            <div className="rounded-lg border border-[var(--hq-hairline)] bg-white/[0.02] p-3 text-center">
              <div className="num text-[20px] font-semibold text-[var(--hq-text)]">{data.activity.reposThisWeek}</div>
              <div className="text-[10.5px] text-[var(--hq-text-ghost)] mt-0.5">Repos touched (7d)</div>
            </div>
            <div className="rounded-lg border border-[var(--hq-hairline)] bg-white/[0.02] p-3 text-center">
              <div className="num text-[20px] font-semibold text-[var(--hq-text)]">{data.profile.publicRepos}</div>
              <div className="text-[10.5px] text-[var(--hq-text-ghost)] mt-0.5">Total public</div>
            </div>
          </div>

          {data.activity.recentEvents.length > 0 && (
            <div className="space-y-0.5 max-h-[360px] overflow-y-auto">
              {data.activity.recentEvents.map((ev, i) => {
                const rowKey = `${ev.type}-${ev.created_at}-${i}`;
                const sharedRow = "flex items-center gap-3 py-2 px-2 rounded-md hover:bg-white/[0.03] transition-colors group";
                const dot = <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />;
                const time = (
                  <span className="text-[11px] text-[var(--hq-text-ghost)] num shrink-0 text-right whitespace-nowrap">
                    {timeAgo(ev.created_at)}
                  </span>
                );
                const repoLink = ev.repoUrl ? (
                  <a
                    href={ev.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10.5px] text-[var(--hq-text-ghost)] shrink-0 whitespace-nowrap hover:text-[var(--hq-text-dim)]"
                  >
                    {ev.repo}
                  </a>
                ) : (
                  <span className="text-[10.5px] text-[var(--hq-text-ghost)] shrink-0 whitespace-nowrap">
                    {ev.repo}
                  </span>
                );
                const labelContent = (
                  <>
                    {ev.description}
                    {ev.headSha && !ev.labelUrl && (
                      <span className="text-[var(--hq-text-faint)] num ml-1.5">· {ev.headSha.slice(0, 7)}</span>
                    )}
                  </>
                );
                const label = ev.labelUrl ? (
                  <a
                    href={ev.labelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] text-[var(--hq-text-dim)] flex-1 truncate hover:text-[var(--accent)] transition-colors"
                  >
                    {labelContent}
                  </a>
                ) : (
                  <span className="text-[12px] text-[var(--hq-text-dim)] flex-1 truncate">
                    {labelContent}
                  </span>
                );
                return ev.labelUrl ? (
                  <div key={rowKey} className={sharedRow}>
                    {dot}
                    {label}
                    {time}
                    {repoLink}
                  </div>
                ) : (
                  <a
                    key={rowKey}
                    href={`https://github.com/${ev.repo}/activity`}
                    target="_blank"
                    rel="noreferrer"
                    className={sharedRow}
                  >
                    {dot}
                    {label}
                    {time}
                    <span className="text-[10.5px] text-[var(--hq-text-ghost)] shrink-0 whitespace-nowrap group-hover:text-[var(--hq-text-dim)]">
                      {ev.repo}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Pinned repos ─────────────────────────────────────── */}
      {data.pinnedRepos.length > 0 && (
        <div className="mt-6">
          <div className="panel p-6">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4" style={{ color: "#f0b132" }} />
              <span className="eyebrow">Pinned Repositories</span>
            </div>
            <div className="flex flex-col gap-2">
              {data.pinnedRepos.map((repo) => (
                <RepoCard key={repo.id} repo={repo} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Recent repos ─────────────────────────────────────── */}
      {data.recentRepos.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <span className="eyebrow">Recently Updated</span>
            </div>
            <span className="text-[11px] text-[var(--hq-text-ghost)]">excluding forks</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.recentRepos.map((repo) => (
              <RepoCard key={repo.id} repo={repo} compact />
            ))}
          </div>
        </div>
      )}

      {/* ── Footer note ──────────────────────────────────────── */}
      <div className="mt-8 text-center text-[11px] text-[var(--hq-text-ghost)]">
        Data from GitHub API · refreshes every minute
      </div>
    </div>
  );
}
