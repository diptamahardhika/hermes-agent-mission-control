"use client";

import { useState, useEffect } from "react";
import { Github, Star, GitBranch, ArrowUpRight, Sparkles } from "lucide-react";

const GH_LEVEL_COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

function PanelSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse space-y-3 ${className}`}><div className="h-4 bg-[var(--hq-card)] rounded w-3/4" /><div className="h-4 bg-[var(--hq-card)] rounded w-1/2" /><div className="h-4 bg-[var(--hq-card)] rounded w-5/6" /></div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[var(--hq-text-ghost)] text-[13px] py-8 text-center">{children}</p>;
}

interface GitHubProfile {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  followers: number;
  following: number;
  publicRepos: number;
  createdAt: string;
}
interface GitHubRepo {
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
}
interface GitHubActivity {
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
interface GitHubContribDay { date: string; count: number; level: number }
interface GitHubContributions {
  totalContributions: number;
  currentStreak: number;
  longestStreak: number;
  weeks: GitHubContribDay[][];
}

function GitHubContributionMatrix({ weeks }: { weeks: GitHubContribDay[][] }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(false); }, []);
  if (loading) return <PanelSkeleton />;
  const paddedWeeks = weeks.map((week) => {
    const padded = [...week];
    while (padded.length < 7) padded.unshift({ date: "", count: 0, level: 0 });
    return padded;
  });
  const rows: { date: string; count: number; level: number }[][] = [];
  for (let di = 0; di < 7; di++) {
    rows.push(paddedWeeks.map((week) => week[di]));
  }
  return (
    <div className="flex flex-col gap-[3px] w-full max-w-full">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-[3px] w-full max-w-full">
          {row.map((day, ci) => (
            <div
              key={day.date || `${ri}-${ci}`}
              title={day.date ? `${day.date}: ${day.count} contribution${day.count === 1 ? "" : "s"}` : ""}
              className="flex-1 aspect-square rounded-[3px] min-h-[3px] min-w-0"
              style={{ background: GH_LEVEL_COLORS[day.level] ?? GH_LEVEL_COLORS[0] }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function GitHubHomeCard({
  profile,
  pinnedRepos,
  activity,
  status,
  contributions,
  onRefresh,
  refreshing,
}: {
  profile: GitHubProfile;
  pinnedRepos: GitHubRepo[];
  activity: GitHubActivity | null;
  status: string | null;
  contributions: GitHubContributions | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(false); }, []);

  return (
    <div className="panel flex flex-col p-6 flex-1">
      {loading && <PanelSkeleton />}
      {/* Profile header */}
      <div className="flex items-center gap-3 mb-4">
        {profile?.avatarUrl && (
          <img src={profile.avatarUrl} alt={profile.login} className="w-10 h-10 rounded-full border border-[var(--hq-hairline)]" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[var(--hq-text)] truncate">{profile?.name || profile?.login || "GitHub"}</div>
          {profile?.bio && <p className="text-[11px] text-[var(--hq-text-ghost)] line-clamp-1">{profile.bio}</p>}
        </div>
        {onRefresh && (
          <button onClick={onRefresh} disabled={refreshing} className="p-1.5 rounded hover:bg-[var(--hq-card)] transition-colors" title="Refresh">
            <Sparkles className="w-3.5 h-3.5 text-[var(--hq-text-ghost)] animate-spin" style={{ animationDuration: "2s" }} />
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mb-4">
        <span className="flex items-center gap-1 text-[11px] text-[var(--hq-text-ghost)]">
          <Star className="w-3 h-3" /> {profile?.publicRepos ?? 0} repos
        </span>
        <span className="flex items-center gap-1 text-[11px] text-[var(--hq-text-ghost)]">
          <GitBranch className="w-3 h-3" /> {activity?.pushesThisWeek ?? 0} pushes this week
        </span>
      </div>

      {/* Pinned repos */}
      {pinnedRepos.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {pinnedRepos.slice(0, 3).map(repo => (
            <a key={repo.id} href={repo.htmlUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 py-1.5 border-b border-[var(--hq-hairline)] last:border-0 group">
              <Github className="w-3.5 h-3.5 text-[var(--hq-text-ghost)] shrink-0" />
              <span className="text-[11px] text-[var(--hq-text-dim)] truncate flex-1 group-hover:text-[var(--hq-text)] transition-colors">{repo.fullName}</span>
              {repo.language && <span className="text-[9px] num text-[var(--hq-text-ghost)]">{repo.language}</span>}
              <span className="text-[9px] num text-[var(--hq-text-ghost)]"><Star className="w-2.5 h-2.5 inline" /> {repo.stars}</span>
            </a>
          ))}
        </div>
      )}

      {/* Contributions heatmap */}
      {contributions && (
        <div className="mb-3">
          <div className="eyebrow mb-1 !text-[10px]">Contributions</div>
          <GitHubContributionMatrix weeks={contributions.weeks} />
          <div className="flex items-center gap-1 mt-1">
            <span className="num text-[10px] text-[var(--hq-text-ghost)]">{contributions.totalContributions} total</span>
            {contributions.currentStreak > 0 && (
              <span className="num text-[10px] text-[var(--hq-up)]">· {contributions.currentStreak}d streak</span>
            )}
          </div>
        </div>
      )}

      <a href="/github" className="mt-3 flex items-center gap-1 text-[var(--hq-text-faint)] text-[11px] font-medium hover:text-[var(--hq-text-dim)] transition-colors group">
        View full GitHub profile
        <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </a>
    </div>
  );
}
