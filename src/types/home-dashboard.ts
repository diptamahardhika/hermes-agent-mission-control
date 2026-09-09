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
  syncedAt: string | null;
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  successRate: number;
  avgLatencyMs: number;
  firstRequestAt: string | null;
  byModel: FreeLLMByModel[];
  days: { date: string; requests: number; tokens: number }[];
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
 * Interface for GitHub home data
 */
export interface GitHubHomeData {
  profile: any | null;
  pinnedRepos: any[];
  recentRepos: any[];
  activity: any | null;
  status: any | null;
  contributions: any | null;
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