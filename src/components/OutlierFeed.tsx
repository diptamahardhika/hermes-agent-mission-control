'use client';

import { useState, useEffect, useMemo } from 'react';

interface Video {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  views: number;
  likes: number;
  comments: number;
  duration: string;
  durationSeconds: number;
  outlierScore: number;
  velocityScore: number;
  daysSincePublish: number;
  niche: string;
  nicheLabel: string;
  query: string;
  channelId: string;
  channelTitle: string;
  channelSubs: number;
  channelMedianViews: number;
  channelThumb: string;
}

interface NicheCount {
  label: string;
  count: number;
}

interface OutlierData {
  date: string;
  scannedAt: string | null;
  totalOutliers: number;
  nicheCounts: Record<string, NicheCount>;
  videos: Video[];
  error?: string;
}

type SortOption = 'outlierScore' | 'views' | 'recent' | 'velocity';
type MinScore = 2 | 3 | 5 | 10;

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString();
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function scoreBadgeColor(score: number): string {
  if (score >= 20) return 'bg-purple-600';
  if (score >= 10) return 'bg-red-600';
  if (score >= 5) return 'bg-orange-500';
  if (score >= 3) return 'bg-yellow-500';
  return 'bg-blue-500';
}

const NICHE_COLORS: Record<string, string> = {
  'founder-brand': 'bg-rose-600',
  'crypto-web3': 'bg-amber-600',
  'content-creation': 'bg-sky-600',
  'agency-growth': 'bg-emerald-600',
  'ai-tools': 'bg-violet-600',
  // legacy
  'ai-marketing': 'bg-emerald-600',
  'founder-content': 'bg-rose-600',
  'youtube-growth': 'bg-sky-600',
  'business-inspiration': 'bg-violet-600',
};

// ── Title pattern analysis ───────────────────────────────────────────────────
interface TitlePattern {
  label: string;
  emoji: string;
  regex: RegExp;
}

const TITLE_PATTERNS: TitlePattern[] = [
  { label: 'How I...', emoji: '🙋', regex: /^how i\b/i },
  { label: 'How to...', emoji: '📖', regex: /^how to\b/i },
  { label: 'I [did X]', emoji: '⚡', regex: /^i (built|made|tried|replaced|gave|created|used|started|quit|spent|found|turned|grew|got|ran|tested|broke|sold|hired|scaled)\b/i },
  { label: 'Number list', emoji: '🔢', regex: /^\d+\s|^(top|best|the \d+)/i },
  { label: 'Why...', emoji: '🤔', regex: /^why\b/i },
  { label: 'Stop / Don\'t', emoji: '🚫', regex: /^(stop|don't|never|quit|avoid)\b/i },
  { label: 'The [thing]', emoji: '🎯', regex: /^the [a-z]+ (that|to|for|you|i|we)/i },
  { label: 'Question', emoji: '❓', regex: /\?$/ },
];

function analyzeTitlePatterns(videos: Video[]): { pattern: TitlePattern; count: number; avgScore: number }[] {
  return TITLE_PATTERNS.map((pattern) => {
    const matches = videos.filter((v) => pattern.regex.test(v.title));
    const avgScore = matches.length
      ? Math.round((matches.reduce((s, v) => s + v.outlierScore, 0) / matches.length) * 10) / 10
      : 0;
    return { pattern, count: matches.length, avgScore };
  })
    .filter((p) => p.count > 0)
    .sort((a, b) => b.avgScore - a.avgScore);
}

function VideoCard({ video }: { video: Video }) {
  return (
    <a
      href={`https://www.youtube.com/watch?v=${video.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-neutral-900/50 rounded-xl border border-neutral-800/50 hover:border-red-500/30 transition-colors p-3 block"
    >
      <div className="relative aspect-video rounded-lg overflow-hidden">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover"
        />
        <span
          className={`absolute top-2 right-2 ${scoreBadgeColor(video.outlierScore)} text-white font-bold text-xs px-2 py-1 rounded-lg`}
        >
          {video.outlierScore}x
        </span>
        <span
          className={`absolute top-2 left-2 ${NICHE_COLORS[video.niche] || 'bg-neutral-600'} text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md`}
        >
          {video.nicheLabel}
        </span>
        <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
          {video.duration}
        </span>
      </div>

      <h3 className="text-sm font-medium text-neutral-200 line-clamp-2 mt-2">
        {video.title}
      </h3>

      <div className="flex items-center gap-2 mt-1.5">
        {video.channelThumb && (
          <img
            src={video.channelThumb}
            alt={video.channelTitle}
            className="w-4 h-4 rounded-full"
          />
        )}
        <span className="text-xs text-neutral-400 truncate">{video.channelTitle}</span>
        <span className="text-xs text-neutral-600">·</span>
        <span className="text-xs text-neutral-500">{formatNumber(video.channelSubs)} subs</span>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-neutral-500">
          {formatNumber(video.views)} views vs {formatNumber(video.channelMedianViews)} median
        </span>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-neutral-600">{timeAgo(video.publishedAt)}</span>
        {video.velocityScore > 0 && (
          <span className="text-xs text-orange-400 font-medium">
            ⚡ {formatNumber(video.velocityScore)}/day
          </span>
        )}
      </div>
    </a>
  );
}

export default function OutlierFeed() {
  const [data, setData] = useState<OutlierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeNiche, setActiveNiche] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('outlierScore');
  const [minScore, setMinScore] = useState<MinScore>(2);

  useEffect(() => {
    fetch('/api/youtube/outliers')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData({ videos: [], totalOutliers: 0, nicheCounts: {}, scannedAt: null, date: '', error: 'Fetch failed' }))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let vids = data.videos.filter((v) => v.outlierScore >= minScore);
    if (activeNiche !== 'all') vids = vids.filter((v) => v.niche === activeNiche);
    if (sortBy === 'outlierScore') vids.sort((a, b) => b.outlierScore - a.outlierScore);
    else if (sortBy === 'views') vids.sort((a, b) => b.views - a.views);
    else if (sortBy === 'velocity') vids.sort((a, b) => (b.velocityScore || 0) - (a.velocityScore || 0));
    else vids.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    return vids;
  }, [data, activeNiche, sortBy, minScore]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.error || data.videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 max-w-md text-center">
        <p className="text-neutral-400">{data?.error || 'No outlier data found'}</p>
        <p className="text-xs text-neutral-500">
          Outlier data is generated by the local scanner. Run this in your terminal from the project root:
        </p>
        <pre className="bg-neutral-800/50 text-neutral-300 text-sm px-4 py-2 rounded-lg w-full text-left">
          node scanner/outlier-scanner.js
        </pre>
      </div>
    );
  }

  const bestScore = Math.max(...data.videos.map((v) => v.outlierScore));
  const avgScore = Math.round((data.videos.reduce((s, v) => s + v.outlierScore, 0) / data.videos.length) * 10) / 10;
  const titlePatterns = analyzeTitlePatterns(data.videos);

  const minScoreOptions: MinScore[] = [2, 3, 5, 10];

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Outliers', value: data.totalOutliers },
          { label: 'Best Score', value: `${bestScore}x` },
          { label: 'Avg Score', value: `${avgScore}x` },
          { label: 'Last Scanned', value: data.scannedAt ? timeAgo(data.scannedAt) : 'Never' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-neutral-900/80 border border-neutral-800/50 rounded-xl px-4 py-3"
          >
            <p className="text-xs text-neutral-500">{stat.label}</p>
            <p className="text-lg font-semibold text-neutral-200 mt-0.5">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Title Patterns */}
      {titlePatterns.length > 0 && (
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-xl p-4">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">📊 Title Patterns That Are Working</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {titlePatterns.map(({ pattern, count, avgScore: avg }) => (
              <div key={pattern.label} className="bg-neutral-800/50 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-neutral-200">{pattern.emoji} {pattern.label}</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">{count} video{count !== 1 ? 's' : ''}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-md ${scoreBadgeColor(avg)} text-white`}>
                  {avg}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter row */}
      <div className="flex flex-col gap-3">
        {/* Niche pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveNiche('all')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              activeNiche === 'all'
                ? 'bg-red-500/20 border-red-500/50 text-red-400'
                : 'bg-neutral-900/50 border-neutral-800/50 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            All ({data.totalOutliers})
          </button>
          {Object.entries(data.nicheCounts).map(([key, nc]) => (
            <button
              key={key}
              onClick={() => setActiveNiche(key)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                activeNiche === key
                  ? 'bg-red-500/20 border-red-500/50 text-red-400'
                  : 'bg-neutral-900/50 border-neutral-800/50 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              {nc.label} ({nc.count})
            </button>
          ))}
        </div>

        {/* Sort + min score */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-xs bg-neutral-900/80 border border-neutral-800/50 text-neutral-300 rounded-lg px-3 py-1.5 outline-none focus:border-red-500/50"
          >
            <option value="outlierScore">Outlier Score</option>
            <option value="velocity">🔥 Velocity (views/day)</option>
            <option value="views">Views</option>
            <option value="recent">Recent</option>
          </select>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-500">Min:</span>
            {minScoreOptions.map((s) => (
              <button
                key={s}
                onClick={() => setMinScore(s)}
                className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                  minScore === s
                    ? 'bg-red-500/20 border-red-500/50 text-red-400'
                    : 'bg-neutral-900/50 border-neutral-800/50 text-neutral-500 hover:border-neutral-700'
                }`}
              >
                {s === 10 ? '10x+' : `${s}x`}
              </button>
            ))}
          </div>

          <span className="text-xs text-neutral-600 ml-auto">
            {filtered.length} video{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Video grid */}
      {filtered.length === 0 ? (
        <p className="text-neutral-500 text-center py-16 text-sm">No videos match your filters</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
