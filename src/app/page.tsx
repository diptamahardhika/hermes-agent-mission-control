"use client";

import { useEffect, useState, useRef } from "react";
import { Twitter, Youtube, ArrowUpRight, ArrowDownRight, ChevronRight, Github, Star, GitBranch } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { Sparkline } from "@/components/sparkline";
import { HermesBriefing } from "@/components/hermes-briefing";
import { ApprovalInbox } from "@/components/approval-inbox";

// ── Types ─────────────────────────────────────────────────
interface HLPosition {
  asset: string; direction: string; unrealizedPnl: number;
  unrealizedPnlPct: number; leverage: number; stopLoss?: number; takeProfit?: number;
}
interface Tweet { id: string; text: string; views: number; engRate: number; postedAt: string | null; tweetUrl: string | null }
interface Video  { title: string; thumbnail: string; url: string; publishedAt: string }
interface Draft  { id: string; text: string }
interface YTIdea { title: string; hook: string }
interface BuildIdea { title: string; description: string; effort: string }
interface Process { name: string; status: string; uptime: string }
// ── GitHub types ───────────────────────────────────────────────
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
interface GitHubHomeData {
  profile: GitHubProfile | null;
  pinnedRepos: GitHubRepo[];
  recentRepos: GitHubRepo[];
  activity: GitHubActivity | null;
  status: string | null;
  contributions: GitHubContributions | null;
}
interface KanbanTask { id: string; title: string; assignee: string; status: string; priority: number }
interface HermesKanban { board: string; slug: string; total: number; counts: Record<string, number>; tasks: KanbanTask[] }
interface ScoreComponent { score: number; weight?: number; label: string; detail?: string }
interface ScoreData { score: number; grade: string; label: string; color: string; period?: string; components: Record<string, ScoreComponent> }

interface HomeData {
  xFollowers: number; xGoal: number; xHandle: string;
  topTweets: Tweet[]; topTweet: Tweet | null; xViewsThisWeek: number;
  totalTweets: number; daysSincePost: number;
  bestPostingDay: string; bestPostingHourStr: string;
  topSageDrafts: Draft[];
  topYoutubeIdeas: YTIdea[];
  topBuildIdeas: BuildIdea[];
  topVideo: Video | null; latestVideo: Video | null;
  ytSubscribers: number; ytGoal: number;
  polyBalance: number; polyWinRate: number; polyTodayPnl: number; polyAllTimePnl: number;
  hlBalance: number; hlPosition: HLPosition | null; hlTodayPnl: number; hlAllTimePnl: number;
  allTimePnl: number; todayPnl: number;
  processes: Process[];
  hermesKanban: HermesKanban;
  xViewsTrend: number[];
  snapshots: { d: string; xf: number; yt: number; pnl: number }[];
  github: GitHubHomeData;
}

const EMPTY: HomeData = {
  xFollowers: 0, xGoal: 100000, xHandle: "yourhandle",
  topTweets: [], topTweet: null, xViewsThisWeek: 0, totalTweets: 0,
  daysSincePost: 999, bestPostingDay: "—", bestPostingHourStr: "—",
  topSageDrafts: [], topYoutubeIdeas: [], topBuildIdeas: [],
  topVideo: null, latestVideo: null, ytSubscribers: 0, ytGoal: 20000,
  polyBalance: 0, polyWinRate: 0, polyTodayPnl: 0, polyAllTimePnl: 0,
  hlBalance: 0, hlPosition: null, hlTodayPnl: 0, hlAllTimePnl: 0,
  allTimePnl: 0, todayPnl: 0, processes: [],
  hermesKanban: { board: "Hermes 24/7 Assistant", slug: "hermes-24-7-assistant", total: 0, counts: {}, tasks: [] },
  xViewsTrend: [], snapshots: [],
  github: { profile: null, pinnedRepos: [], recentRepos: [], activity: null, status: null, contributions: null },
};

// ── Animated counter ──────────────────────────────────────
function useCountUp(target: number, duration = 1400, enabled = true) {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!enabled || target === 0 || reduce) { setVal(target); return; }
    const start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 4);
      setVal(Math.round(target * ease));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration, enabled]);
  return val;
}

// ── Helpers ───────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) {
    const k = Math.round(n / 1_000);
    if (k >= 1000) return (n / 1_000_000).toFixed(1) + "M";
    return k + "K";
  }
  return n.toString();
}
function fmtExact(n: number) { return n.toLocaleString("en-US"); }
function fmtUsd(n: number, alwaysSign = false) {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = n >= 0 ? (alwaysSign ? "+" : "") : "-";
  return `${sign}$${abs}`;
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  const hrs  = Math.floor(diff / 3600000);
  if (days > 0) return `${days}d ago`;
  if (hrs  > 0) return `${hrs}h ago`;
  return "just now";
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Still up";
}

// Local-dev preview only — never runs in production builds. Lets the full
// card structure (delta + sparkline) show before real snapshot history exists.
const DEV_PREVIEW = process.env.NODE_ENV !== "production";
function sampleSeries(current: number, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const ramp = 0.82 + (0.18 * i) / (n - 1);
    const wobble = 1 + Math.sin(i * 1.3) * 0.03;
    return Math.max(0, Math.round(current * ramp * wobble));
  });
}
type Snap = { d: string; xf: number; yt: number; pnl: number };
function snapDelta(snaps: Snap[], key: "xf" | "yt" | "pnl") {
  const series = snaps.map(s => s[key]);
  if (snaps.length < 2) return { delta: null as number | null, deltaPct: null as number | null, label: undefined as string | undefined, series };
  const first = snaps[0][key];
  const last = snaps[snaps.length - 1][key];
  const delta = last - first;
  const deltaPct = first !== 0 ? (delta / Math.abs(first)) * 100 : 0;
  return { delta, deltaPct, label: `${snaps.length - 1}d`, series };
}
function withDevPreview(d: { delta: number | null; deltaPct: number | null; label?: string; series: number[] }, current: number) {
  if (!DEV_PREVIEW || d.series.length >= 2) return d;
  const series = sampleSeries(current, 12);
  const first = series[0], last = series[series.length - 1];
  return { delta: last - first, deltaPct: first ? ((last - first) / first) * 100 : 0, label: "sample", series };
}

// ── Section header ────────────────────────────────────────
function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="eyebrow">{children}</span>
      <span className="h-px flex-1 bg-[var(--hq-hairline)]" />
      {right}
    </div>
  );
}

// ── Ideas section ─────────────────────────────────────────
type IdeaTab = "x" | "youtube" | "builds";
function IdeasPanel({ sageDrafts, ytIdeas, buildIdeas }: {
  sageDrafts: Draft[]; ytIdeas: YTIdea[]; buildIdeas: BuildIdea[];
}) {
  const [tab, setTab] = useState<IdeaTab>("x");
  const tabs: { key: IdeaTab; label: string; count: number }[] = [
    { key: "x", label: "X", count: sageDrafts.length },
    { key: "youtube", label: "YouTube", count: ytIdeas.length },
    { key: "builds", label: "Builds", count: buildIdeas.length },
  ];

  return (
    <div className="panel flex flex-col p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow">Top Ideas</span>
        <div className="flex gap-1 rounded-lg border border-[var(--hq-hairline)] p-0.5">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                tab === t.key ? "bg-white/[0.08] text-[var(--hq-text)]" : "text-[var(--hq-text-ghost)] hover:text-[var(--hq-text-dim)]"
              }`}
            >
              {t.label}
              {t.count > 0 && <span className="ml-1 num text-[var(--hq-text-ghost)]">{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1 min-h-[172px]">
        {tab === "x" && (sageDrafts.length > 0 ? sageDrafts.map((d, i) => (
          <a key={d.id} href="/x-content" className="group flex gap-3 items-center py-2 border-b border-[var(--hq-hairline)] last:border-0 hover:opacity-100 transition-opacity">
            <span className="num text-[11px] text-[var(--hq-text-ghost)] w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
            <p className="text-[var(--hq-text-dim)] text-[13px] leading-snug line-clamp-1 flex-1 group-hover:text-[var(--hq-text)] transition-colors">{d.text}</p>
            <ChevronRight className="w-3.5 h-3.5 text-[var(--hq-text-ghost)] group-hover:text-[var(--hq-text-dim)] shrink-0 transition-all group-hover:translate-x-0.5" />
          </a>
        )) : <Empty>No pending drafts.</Empty>)}

        {tab === "youtube" && (ytIdeas.length > 0 ? ytIdeas.map((it, idx) => (
          <a key={idx} href="/youtube" className="group flex gap-3 items-center py-2 border-b border-[var(--hq-hairline)] last:border-0">
            <span className="num text-[11px] text-[var(--hq-text-ghost)] w-5 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
            <p className="text-[var(--hq-text-dim)] text-[13px] font-medium line-clamp-1 flex-1 group-hover:text-[var(--hq-text)] transition-colors">{it.title}</p>
            <ChevronRight className="w-3.5 h-3.5 text-[var(--hq-text-ghost)] group-hover:text-[var(--hq-text-dim)] shrink-0 transition-all group-hover:translate-x-0.5" />
          </a>
        )) : <Empty>No YouTube ideas yet.</Empty>)}

        {tab === "builds" && (buildIdeas.length > 0 ? buildIdeas.map((it, idx) => (
          <div key={idx} className="flex gap-3 items-center py-2 border-b border-[var(--hq-hairline)] last:border-0">
            <span className="num text-[11px] text-[var(--hq-text-ghost)] w-5 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
            <p className="text-[var(--hq-text-dim)] text-[13px] font-medium line-clamp-1 flex-1">{it.title}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md num border shrink-0"
              style={it.effort === "quick win"
                ? { color: "var(--hq-up)", borderColor: "rgba(52,211,153,0.25)", background: "rgba(52,211,153,0.08)" }
                : it.effort === "large"
                ? { color: "var(--hq-down)", borderColor: "rgba(251,113,133,0.25)", background: "rgba(251,113,133,0.08)" }
                : { color: "var(--hq-warn)", borderColor: "rgba(251,191,36,0.25)", background: "rgba(251,191,36,0.08)" }}>
              {it.effort}
            </span>
          </div>
        )) : <Empty>No build ideas yet.</Empty>)}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[var(--hq-text-ghost)] text-[13px] py-8 text-center">{children}</p>;
}

// ── Top tweets ────────────────────────────────────────────
function TopTweetsPanel({ tweets }: { tweets: Tweet[] }) {
  return (
    <div className="panel flex flex-col p-6 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Twitter className="w-3.5 h-3.5" style={{ color: "#38bdf8" }} />
        <span className="eyebrow">Top Tweets · 7d</span>
      </div>
      {tweets.length === 0 ? <Empty>No tweet data yet</Empty> : (
        <div className="space-y-0">
          {tweets.slice(0, 3).map((t, i) => (
            <a key={t.id} href={t.tweetUrl || "/x"} target="_blank" rel="noreferrer"
              className="group flex gap-3 py-3 border-b border-[var(--hq-hairline)] last:border-0">
              <span className="num text-[11px] text-[var(--hq-text-ghost)] w-5 shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex-1 min-w-0">
                {t.text
                  ? <p className="text-[var(--hq-text-dim)] text-[13px] leading-snug line-clamp-2 mb-1.5 group-hover:text-[var(--hq-text)] transition-colors">{t.text}</p>
                  : <p className="text-[var(--hq-text-ghost)] text-[13px] italic mb-1.5">External tweet</p>}
                <div className="flex items-center gap-3 text-[11px] num">
                  <span className="text-[var(--hq-text)] font-semibold">{fmt(t.views)}<span className="text-[var(--hq-text-ghost)] font-normal"> views</span></span>
                  <span className="text-[var(--hq-text-faint)]">{t.engRate.toFixed(1)}% eng</span>
                  {t.postedAt && <span className="text-[var(--hq-text-ghost)]">{timeAgo(t.postedAt)}</span>}
                </div>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-[var(--hq-text-ghost)] group-hover:text-[var(--hq-text-dim)] shrink-0 mt-0.5 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── X analytics panel ─────────────────────────────────────
function XAnalyticsPanel({ views, trend, totalTweets, bestDay, bestHour }: {
  views: number; trend: number[]; totalTweets: number; bestDay: string; bestHour: string;
}) {
  return (
    <div className="panel flex flex-col p-6 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Twitter className="w-3.5 h-3.5" style={{ color: "#38bdf8" }} />
        <span className="eyebrow">X Analytics</span>
      </div>
      <div className="space-y-4">
        <div>
          <div className="eyebrow mb-2 !text-[9.5px]">Views · 7d</div>
          <div className="num font-semibold text-[40px] leading-[0.95] tracking-[-0.02em] text-[var(--hq-text)]">{fmt(views)}</div>
          {trend.some(v => v > 0) && <Sparkline data={trend} color="#38bdf8" area idSeed="xviews" className="h-9 mt-3" />}
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="eyebrow mb-1.5 !text-[9.5px]">Tracked</div>
            <div className="num font-semibold text-[18px] text-[var(--hq-text)]">{fmtExact(totalTweets)}</div>
          </div>
          <div>
            <div className="eyebrow mb-1.5 !text-[9.5px]">Best window</div>
            <div className="text-[13px] font-medium text-[var(--hq-text-dim)]">{bestDay}<span className="num"> · {bestHour}</span></div>
          </div>
        </div>
      </div>
      <a href="/x" className="mt-auto pt-4 flex items-center gap-1 text-[var(--hq-text-faint)] text-[11px] font-medium hover:text-[var(--hq-text-dim)] transition-colors group">
        Open X dashboard <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </a>
    </div>
  );
}

// ── YouTube ───────────────────────────────────────────────
function YouTubeCard({ video, label }: { video: Video; label: string }) {
  return (
    <a href={video.url} target="_blank" rel="noreferrer" className="panel panel-interactive group flex flex-col overflow-hidden">
      {video.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.thumbnail} alt={video.title} className="w-full aspect-video object-cover opacity-75 group-hover:opacity-100 transition-opacity" />
      )}
      <div className="p-4">
        <div className="eyebrow mb-2" style={{ color: "#f87171" }}>{label}</div>
        <p className="text-[var(--hq-text-dim)] text-[13px] font-medium line-clamp-2 leading-snug group-hover:text-[var(--hq-text)] transition-colors">{video.title}</p>
        {video.publishedAt && <p className="num text-[var(--hq-text-ghost)] text-[11px] mt-2">{timeAgo(video.publishedAt)}</p>}
      </div>
    </a>
  );
}

// ── YouTube: Top Performing vs Latest (tabbed) ────────────
function YouTubeVideoTabs({ topVideo, latestVideo }: { topVideo: Video | null; latestVideo: Video | null }) {
  const [tab, setTab] = useState<"top" | "latest">("top");
  const video = tab === "top" ? (topVideo ?? latestVideo) : (latestVideo ?? topVideo);
  if (!video) return null;
  const Btn = ({ k, label }: { k: "top" | "latest"; label: string }) => (
    <button
      onClick={() => setTab(k)}
      className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
        tab === k ? "bg-white/[0.08] text-[var(--hq-text)]" : "text-[var(--hq-text-ghost)] hover:text-[var(--hq-text-dim)]"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="panel flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 p-2 border-b border-[var(--hq-hairline)]">
        <span className="eyebrow ml-2 mr-1" style={{ color: "#f87171" }}>YouTube</span>
        <Btn k="top" label="Top Performing" />
        <Btn k="latest" label="Latest" />
      </div>
      <a href={video.url} target="_blank" rel="noreferrer" className="group block">
        {video.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail} alt={video.title} className="w-full aspect-video object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
        )}
        <div className="p-4">
          <p className="text-[var(--hq-text-dim)] text-[13px] font-medium line-clamp-2 leading-snug group-hover:text-[var(--hq-text)] transition-colors">{video.title}</p>
          {video.publishedAt && <p className="num text-[var(--hq-text-ghost)] text-[11px] mt-2">{timeAgo(video.publishedAt)}</p>}
        </div>
      </a>
    </div>
  );
}

// ── GitHub contribution matrix (GitHub-style heatmap) ───────
const GH_LEVEL_COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

function GitHubContributionMatrix({ weeks }: { weeks: GitHubContribDay[][] }) {
  return (
    <div className="flex gap-[3px] w-full">
      {weeks.map((week, wi) => {
        const padded = [...week];
        while (padded.length < 7) padded.unshift({ date: "", count: 0, level: 0 });
        return (
          <div key={wi} className="flex flex-col gap-[3px] flex-1 min-w-0">
            {padded.map((day, di) => (
              <div
                key={day.date || `${wi}-${di}`}
                title={day.date ? `${day.date}: ${day.count} contribution${day.count === 1 ? "" : "s"}` : ""}
                className="flex-1 w-full aspect-square rounded-[3px] min-h-[3px]"
                style={{ background: GH_LEVEL_COLORS[day.level] ?? GH_LEVEL_COLORS[0] }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── GitHub profile card for dashboard home ─────────────────────
function GitHubHomeCard({
  profile,
  pinnedRepos,
  activity,
  status,
  contributions,
}: {
  profile: GitHubProfile;
  pinnedRepos: GitHubRepo[];
  activity: GitHubActivity | null;
  status: string | null;
  contributions: GitHubContributions | null;
}) {
  return (
    <div className="panel flex flex-col p-6 h-full">
      {/* Avatar + name */}
      <div className="flex items-center gap-3 mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profile.avatarUrl}
          alt={profile.login}
          className="w-10 h-10 rounded-full border-2 border-[var(--hq-hairline)] object-cover"
        />
        <div>
          <div className="text-[13px] font-semibold text-[var(--hq-text)]">
            {profile.name || profile.login}
          </div>
          <div className="text-[11px] text-[var(--hq-text-ghost)]">
            @{profile.login} · {profile.publicRepos} repos · {profile.followers} followers
          </div>
        </div>
      </div>

      {/* Contribution matrix */}
      {contributions && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5" style={{ color: "#39d353" }} />
              <span className="text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">Contributions</span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="num text-[var(--hq-text-dim)]">
                <span className="text-[var(--accent)] font-semibold">{contributions.currentStreak}</span> day streak
              </span>
              <span className="text-[var(--hq-text-ghost)]">·</span>
              <span className="num text-[var(--hq-text-dim)]">
                <span className="text-[var(--accent)] font-semibold">{contributions.longestStreak}</span> best
              </span>
            </div>
          </div>
          <GitHubContributionMatrix weeks={contributions.weeks} />
          <div className="mt-2 text-[10.5px] text-[var(--hq-text-ghost)]">
            {contributions.totalContributions} contributions in the last year
          </div>
        </div>
      )}

      {/* Bio */}
      {profile.bio && (
        <p className="text-[12px] text-[var(--hq-text-dim)] mb-4 leading-snug">
          {profile.bio}
        </p>
      )}

      {/* Status */}
      {status && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-2.5 py-1.5">
          <div className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] animate-ping opacity-50" />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
          </div>
          <span className="text-[11.5px] text-[var(--hq-text-dim)]">{status}</span>
        </div>
      )}

      {/* Location / company */}
      {(profile.company || profile.location) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 text-[11px] text-[var(--hq-text-ghost)]">
          {profile.company && <span>{profile.company}</span>}
          {profile.location && <span>{profile.location}</span>}
        </div>
      )}

      {/* Pinned repos */}
      {pinnedRepos.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-2">
            <Star className="w-3.5 h-3.5" style={{ color: "#f0b132" }} />
            <span className="text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">Pinned</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {pinnedRepos.slice(0, 4).map((repo) => (
              <a
                key={repo.id}
                href={repo.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-2 rounded-md border border-[var(--hq-hairline)] bg-white/[0.02] px-2.5 py-1.5 hover:bg-white/[0.04] transition-colors"
              >
                <span className="text-[12px] font-medium text-[var(--hq-text)] truncate flex-1">
                  {repo.name}
                </span>
                <span className="text-[10px] text-[var(--hq-text-ghost)]">
                  {repo.stars} ★
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Activity */}
      {activity && (
        <div className="mt-auto pt-3 border-t border-[var(--hq-hairline)]">
          <div className="flex items-center gap-1 mb-2">
            <GitBranch className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
            <span className="text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">Activity</span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="num text-[var(--accent)] font-semibold">
              {activity.pushesThisWeek} pushes (7d)
            </span>
            <span className="text-[var(--hq-text-ghost)]">·</span>
            <span className="num text-[var(--hq-text-dim)]">
              {activity.pushesThisMonth} pushes (30d)
            </span>
            <span className="text-[var(--hq-text-ghost)]">·</span>
            <span className="num text-[var(--hq-text-dim)]">
              {activity.reposThisWeek} repos touched
            </span>
          </div>
        </div>
      )}

      {/* Link */}
      <a
        href="/github"
        className="mt-3 flex items-center gap-1 text-[var(--hq-text-faint)] text-[11px] font-medium hover:text-[var(--hq-text-dim)] transition-colors group"
      >
        View full GitHub profile
        <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </a>
    </div>
  );
}

// ── Agents strip ──────────────────────────────────────────
function AgentsStrip({ processes }: { processes: Process[] }) {
  if (processes.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="eyebrow mr-1">System</span>
      {processes.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 rounded-lg border border-[var(--hq-hairline)] bg-white/[0.02] px-2.5 py-1.5">
          <span className="relative flex w-1.5 h-1.5">
            {p.status === "online" && <span className="absolute inline-flex h-full w-full rounded-full animate-ping" style={{ background: "color-mix(in srgb, var(--up) 60%, transparent)" }} />}
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: p.status === "online" ? "var(--up)" : "var(--down)" }} />
          </span>
          <span className="text-[var(--hq-text-dim)] text-[12px]">{p.name}</span>
          <span className="num text-[var(--hq-text-ghost)] text-[10px]">{p.uptime}</span>
        </div>
      ))}
    </div>
  );
}

// ── Hermes Kanban ─────────────────────────────────────────
function HermesKanbanPanel({ kanban }: { kanban: HermesKanban }) {
  const statusColor = (s: string) => {
    const k = s.toLowerCase();
    if (k.includes("done") || k.includes("complete")) return "var(--hq-up)";
    if (k.includes("progress") || k.includes("doing")) return "var(--accent)";
    if (k.includes("block")) return "var(--hq-down)";
    return "var(--hq-text-faint)";
  };
  const entries = Object.entries(kanban.counts || {});
  return (
    <div className="panel flex flex-col p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          <span className="eyebrow">Hermes Board</span>
          <p className="text-[13px] text-[var(--hq-text-dim)] truncate mt-1">{kanban.board}</p>
        </div>
        <span className="num text-[22px] font-semibold text-[var(--hq-text)] shrink-0">{kanban.total}</span>
      </div>

      {entries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {entries.map(([status, count]) => (
            <span key={status} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium num"
              style={{ color: statusColor(status), background: `color-mix(in srgb, ${statusColor(status)} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${statusColor(status)} 22%, transparent)` }}>
              {status} {count}
            </span>
          ))}
        </div>
      )}

      {kanban.tasks.length === 0 ? <Empty>No active tasks.</Empty> : (
        <div className="space-y-0">
          {kanban.tasks.slice(0, 5).map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-[var(--hq-hairline)] last:border-0">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColor(t.status) }} />
              <p className="text-[13px] text-[var(--hq-text-dim)] leading-snug line-clamp-1 flex-1">{t.title}</p>
              {t.assignee && <span className="num text-[10.5px] text-[var(--hq-text-ghost)] shrink-0">{t.assignee}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Momentum Score gauge (dashboard hero) ─────────────────
function ScoreGauge({ score }: { score: ScoreData }) {
  const tier = score.score >= 80 ? "var(--hq-up)" : score.score >= 60 ? "var(--hq-warn)" : "var(--hq-down)";
  const counted = useCountUp(score.score, 1400, true);
  const R = 50, C = 2 * Math.PI * R;
  const pct = Math.min(100, Math.max(0, counted));
  const comps = Object.entries(score.components || {}).slice(0, 4);
  return (
    <div className="flex items-center gap-5">
      <div className="relative w-[112px] h-[112px] shrink-0">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--hq-hairline)" strokeWidth="6" />
          <circle cx="60" cy="60" r="50" fill="none" stroke={tier} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${(C * pct) / 100} ${C}`} style={{ transition: "stroke-dasharray 0.5s var(--ease)" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="num font-semibold text-[32px] leading-none tracking-[-0.02em]" style={{ color: tier }}>{Math.round(counted)}</span>
          <span className="num text-[10.5px] text-[var(--hq-text-ghost)] mt-1">{score.grade}</span>
        </div>
      </div>
      <div className="hidden sm:block w-[176px]">
        <div className="eyebrow !text-[9.5px]">Momentum</div>
        <div className="text-[14px] font-semibold mt-0.5 mb-2.5" style={{ color: tier }}>{score.label}</div>
        <div className="space-y-[7px]">
          {comps.map(([k, c]) => {
            const cc = c.score >= 80 ? "var(--hq-up)" : c.score >= 40 ? "var(--hq-warn)" : "var(--hq-down)";
            return (
              <div key={k} className="flex items-center gap-2">
                <span className="num text-[9.5px] text-[var(--hq-text-ghost)] w-14 truncate">{c.label.split(" ")[0]}</span>
                <div className="h-[3px] flex-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: cc, opacity: 0.85, transition: "width 1s var(--ease)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState<HomeData>(EMPTY);
  const [time, setTime] = useState(new Date());
  const [loaded, setLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [score, setScore] = useState<ScoreData | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    fetch("/api/score").then(r => r.ok ? r.json() : null).then(d => { if (d) setScore(d); }).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    fetch("/api/home")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setData(d); setTimeout(() => setLoaded(true), 100); } })
      .catch(() => {});
    const iv = setInterval(() => {
      fetch("/api/home").then(r => r.ok ? r.json() : null).then(d => { if (d) setData(d); }).catch(() => {});
    }, 60_000);
    return () => clearInterval(iv);
  }, []);

  if (!mounted) return null;

  const xd = withDevPreview(snapDelta(data.snapshots, "xf"), data.xFollowers);
  const ytd = withDevPreview(snapDelta(data.snapshots, "yt"), data.ytSubscribers);
  const xViewsSeries = DEV_PREVIEW && !data.xViewsTrend.some(v => v > 0)
    ? sampleSeries(data.xViewsThisWeek || 42000, 14)
    : data.xViewsTrend;

  const stale = data.daysSincePost > 3 && data.daysSincePost < 999;
  const rise = (i: number) => ({ animationDelay: `${i * 60}ms` });

  return (
    <>
      <div className="relative z-10 w-full mx-auto pb-16">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="hq-rise pt-4 pb-10 flex flex-wrap items-end justify-between gap-6" style={rise(0)}>
          <div>
            <div className="eyebrow mb-2.5">{greeting()}</div>
            <h1 className="text-[40px] font-semibold tracking-[-0.025em] leading-none text-[var(--hq-text)]">{process.env.NEXT_PUBLIC_OWNER_NAME || "Founder"}</h1>
            <p className="num text-[var(--hq-text-ghost)] text-[12.5px] mt-3">
              {time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              {"  ·  "}
              {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </p>
          </div>
          <div className="flex flex-col items-end gap-4">
            <div className="flex items-center gap-2.5">
              {data.daysSincePost < 999 && (
                <div className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                  style={stale
                    ? { color: "var(--hq-warn)", borderColor: "rgba(251,191,36,0.22)", background: "rgba(251,191,36,0.07)" }
                    : { color: "var(--hq-up)", borderColor: "rgba(52,211,153,0.22)", background: "rgba(52,211,153,0.07)" }}>
                  <span className="num">{data.daysSincePost === 0 ? "Posted today" : `${data.daysSincePost}d since post`}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 rounded-full border border-[var(--hq-hairline)] bg-white/[0.02] px-2.5 py-1">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full animate-ping" style={{ background: "color-mix(in srgb, var(--up) 60%, transparent)" }} />
                  <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: "var(--up)" }} />
                </span>
                <span className="eyebrow !text-[9.5px] !text-[var(--hq-text-faint)]">Live</span>
              </div>
            </div>
            {score && <ScoreGauge score={score} />}
          </div>
        </div>

        {/* ── Platform stacks: X (with analytics) · YouTube (with video) ─ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          {/* X */}
          <div className="flex flex-col gap-5 hq-rise" style={rise(1)}>
            <MetricCard
              label="X Followers" value={data.xFollowers} format={fmtExact}
              delta={xd.delta} deltaPct={xd.deltaPct} deltaLabel={xd.label} trend={xd.series}
              goal={data.xGoal} goalFormat={fmt}
              icon={<Twitter className="w-4 h-4" />} accent="#38bdf8" href="/x" loaded={loaded}
            />
            <XAnalyticsPanel views={data.xViewsThisWeek} trend={xViewsSeries} totalTweets={data.totalTweets} bestDay={data.bestPostingDay} bestHour={data.bestPostingHourStr} />
          </div>
          {/* GitHub */}
          <div className="flex flex-col gap-5 hq-rise" style={rise(2)}>
            <MetricCard
              label="GitHub Contributions"
              value={data.github?.contributions?.totalContributions ?? 0}
              format={fmtExact}
              delta={null} deltaPct={null} deltaLabel={undefined} trend={[]}
              goal={undefined} goalFormat={undefined}
              icon={<Github className="w-4 h-4" />} accent="#f0b132" href="/github" loaded={loaded}
            />
            {data.github?.profile && (
              <GitHubHomeCard
                profile={data.github.profile}
                pinnedRepos={data.github.pinnedRepos}
                activity={data.github.activity}
                status={data.github.status}
                contributions={data.github.contributions}
              />
            )}
          </div>
        </div>

        {/* ── Brief + Approval inbox (side-by-side on wide) ─ */}
        <div className="mt-5 grid grid-cols-1 xl:grid-cols-3 gap-5 items-stretch">
          <div className="xl:col-span-2 hq-rise" style={rise(5)}>
            <HermesBriefing />
          </div>
          <div className="xl:col-span-1 hq-rise" style={rise(6)}>
            <ApprovalInbox compact />
          </div>
        </div>

        {/* ── Signal ──────────────────────────────────────── */}
        <div className="mt-14">
          <SectionLabel>Signal</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="hq-rise" style={rise(4)}><TopTweetsPanel tweets={data.topTweets} /></div>
            <div className="hq-rise" style={rise(5)}><IdeasPanel sageDrafts={data.topSageDrafts} ytIdeas={data.topYoutubeIdeas} buildIdeas={data.topBuildIdeas} /></div>
          </div>
        </div>

        {/* ── Agents strip ────────────────────────────────── */}
        <div className="mt-14">
          <AgentsStrip processes={data.processes} />
        </div>
      </div>
    </>
  );
}
