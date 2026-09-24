"use strict";
// Shared home dashboard types to avoid anonymous inline types in interfaces

/**
 * Base interface for byModel structures used across Spend, OmniSpend, and FreeLLM data
 * Contains the common fields that are shared across different byModel variations
 */
export interface BaseByModel {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  tokens: number;
}

/**
 * byModel structure for Spend data - tracks API tokens, calls, and costs
 */
export interface SpendByModel extends BaseByModel {
  sessions: number;
  calls?: number;
}

/**
 * byModel structure for OmniSpend data - tracks OmniRoute API tokens, calls, and costs
 */
export interface OmniSpendByModel extends BaseByModel {
  calls: number;
}

/**
 * byModel structure for FreeLLM data - tracks FreeLLM API requests and tokens
 */
export interface FreeLLMByModel extends BaseByModel {
  requests: number;
  avgLatencyMs: number | null;
}

/**
 * Homelab system status information
 */
export interface HomelabSystem {
  hostname: string;
  os: string;
  uptime: string;
  cpu_usage_percent: number;
  memory_used_percent: number;
  disk_used_percent: number;
}

/**
 * Spend data for tracking API token usage and costs
 */
export interface SpendData {
  syncedAt: string | null;
  totalTokens: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  sessions: number | null;
  toolCalls: number | null;
  byModel: SpendByModel[];
  days: { date: string; tokens: number }[];
}

/**
 * OmniSpend data for tracking OmniRoute API token usage and costs
 */
export interface OmniSpendData {
  syncedAt: string | null;
  totalTokens: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number;
  totalCalls: number;
  byModel: OmniSpendByModel[];
  days: { date: string; tokens: number }[];
}

/**
 * FreeLLM data for tracking FreeLLM API usage and costs
 */
export interface FreeLLMData {
  configured: boolean;
  baseUrl?: string | null;
  syncedAt: string | null;
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  successRate: number;
  avgLatencyMs: number;
  firstRequestAt: string | null;
  byModel: FreeLLMByModel[];
  days: { date: string; requests: number; tokens: number; avgLatencyMs: number | null }[];
  lifetimeTotalRequests: number | null;
  estimatedCostSavings: number | null;
  pinnedRequests: number | null;
  pinHonoredRequests: number | null;
  requestTypeCounts: Record<string, number> | null;
}

/**
 * Interface for homelab system status data
 */
export interface HomelabHomeData {
  connected: boolean;
  checkedAt: string;
  counts: {
servers: number;
     serversUp: number;
     services: number;
     servicesUp: number;
     containers: number;
     runningContainers: number;
   };
   system: HomelabSystem | null;
 }
 
 /**
  * Coq Finance data — spending, budget, and category breakdowns.
  */
 export interface CoqFinanceData {
  spending: { total: number; byCategory: { name: string; spent: number; budget: number; color: string }[] };
  budget: { totalBudget: number; remaining: number; percentageUsed: number };
  days: { date: string; amount: number }[];
}

/**
 * Interface for snapshot data
 */
export interface Snapshot {
  d: string;
  xf: number;
  yt: number;
  pnl: number;
}

/**
 * Tweet data structure
 */
export interface Tweet {
  id: string;
  text: string;
  views: number;
  engRate: number;
  postedAt: string | null;
  tweetUrl: string | null;
}

/**
 * Draft data structure
 */
export interface Draft {
  id: string;
  text: string;
}

/**
 * YouTube idea data structure
 */
export interface YTIdea {
  title: string;
  hook: string;
}

/**
 * Build idea data structure
 */
export interface BuildIdea {
  title: string;
  description: string;
  effort: string;
}

/**
 * Board idea data structure
 */
export interface BoardIdea {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  source: string | null;
  estimatedTime: string | null;
  agent: string | null;
}

/**
 * Video data structure
 */
export interface Video {
  title: string;
  thumbnail: string;
  url: string;
  publishedAt: string;
}

/**
 * HL Position data structure
 */
export interface HLPosition {
  asset: string;
  direction: string;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
}

/**
 * Process data structure
 */
export interface Process {
  name: string;
  status: string;
  uptime: string;
}

/**
 * Hermes Kanban data structure
 */
export interface HermesKanban {
  board: string;
  slug: string;
  total: number;
  counts: Record<string, number>;
  tasks: KanbanTask[];
}

/**
 * Kanban task data structure
 */
export interface KanbanTask {
  id: string;
  title: string;
  assignee: string;
  status: string;
  priority: number;
  result?: string | null;
}

/**
 * GitHub profile data structure
 */
export interface GitHubProfile {
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

/**
 * GitHub repository data structure
 */
export interface GitHubRepo {
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

/**
 * GitHub activity data structure
 */
export interface GitHubActivity {
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

/**
 * GitHub contribution day data structure
 */
export interface GitHubContribDay {
  date: string;
  count: number;
  level: number;
}

/**
 * GitHub contributions data structure
 */
export interface GitHubContributions {
  totalContributions: number;
  currentStreak: number;
  longestStreak: number;
  weeks: GitHubContribDay[][];
}

/**
 * GitHub home data structure
 */
export interface GitHubHomeData {
  profile: GitHubProfile | null;
  pinnedRepos: GitHubRepo[];
  recentRepos: GitHubRepo[];
  activity: GitHubActivity | null;
  status: string | null;
  contributions: GitHubContributions | null;
}

/**
 * Score component data structure
 */
export interface ScoreComponent {
  score: number;
  weight?: number;
  label: string;
  detail?: string;
}

/**
 * Score data structure
 */
export interface ScoreData {
  score: number;
  grade: string;
  label: string;
  color: string;
  period?: string;
  components: Record<string, ScoreComponent>;
}

/**
 * Complete home dashboard data structure
 */
export interface HomeData {
   xFollowers: number;
   xGoal: number;
   xHandle: string;
   topTweets: Tweet[];
   topTweet: Tweet | null;
   xViewsThisWeek: number;
   totalTweets: number;
   daysSincePost: number;
   bestPostingDay: string;
   bestPostingHourStr: string;
   topSageDrafts: Draft[];
   topYoutubeIdeas: YTIdea[];
   topBuildIdeas: BuildIdea[];
   topIdeas: BoardIdea[];
   topVideo: Video | null;
   latestVideo: Video | null;
   ytSubscribers: number;
   ytGoal: number;
   polyBalance: number;
   polyWinRate: number;
   polyTodayPnl: number;
   polyAllTimePnl: number;
   hlBalance: number;
   hlPosition: HLPosition | null;
   hlTodayPnl: number;
   hlAllTimePnl: number;
   hlAssets?: { asset: string; amount: number; usdValue: number; wallet?: string }[];
   hlLastSync?: string | null;
   lastUpdated?: string | null;
   allTimePnl: number;
   todayPnl: number;
   processes: Process[];
   hermesKanban: HermesKanban;
   xViewsTrend: number[];
   snapshots: Snapshot[];
   github: GitHubHomeData;
   homelab: HomelabHomeData;
   spend: SpendData;
   omniSpend?: OmniSpendData | null;
   freeLLM?: FreeLLMData | null;
   coq?: CoqFinanceData | null;
}