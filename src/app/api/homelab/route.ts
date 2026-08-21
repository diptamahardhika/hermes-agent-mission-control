import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ServerStatus = {
  name: string; host: string; port: number; type: string;
  alive: boolean; latency: string; error?: string;
};
type ServiceStatus = {
  name: string; url: string; type: string; status: string;
  status_code?: number; latency: string; error?: string; resolved_ip?: string;
};
type Container = {
  id: string; name: string; image: string; state: string;
  status: string; ports: string; created: number;
};
type SystemStats = {
  hostname: string; os: string; kernel: string; uptime: string;
  cpu_count: number; cpu_usage_percent: number;
  memory_total_mb: number; memory_used_mb: number; memory_free_mb: number;
  memory_used_percent: number;
  disk_total_gb: number; disk_used_gb: number; disk_free_gb: number;
  disk_used_percent: number;
  network_rx_speed: number; network_tx_speed: number; ip_address: string;
};
type SysSample = { ts: number; cpu: number; memory_used_percent: number; disk_used_percent: number };
type HistoryStats = {
  uptime_percent: number; last_down: string; samples: number;
  up_samples: number; state: string;
};

function summarize(series: SysSample[], key: "cpu" | "memory_used_percent" | "disk_used_percent") {
  const vals = (series || []).map(s => s[key]);
  if (!vals.length) return [];
  const step = Math.max(1, Math.ceil(vals.length / 96));
  const downsampled: number[] = [];
  for (let i = 0; i < vals.length; i += step) downsampled.push(vals[i]);
  return downsampled.slice(-96);
}

export async function GET() {
  let connected = false;
  let syncedAt = "";
  let overview: {
    servers: ServerStatus[]; services: ServiceStatus[]; containers: Container[];
    system: SystemStats | null; checked_at?: string;
  } | null = null;
  let systemHistory: SysSample[] = [];
  let history: Record<string, HistoryStats> = {};

  try {
    const row = await prisma.dataStore.findUnique({ where: { key: "homelab-monitor" } });
    const data = row?.data as {
      syncedAt?: string;
      overview?: {
        servers: ServerStatus[]; services: ServiceStatus[]; containers: Container[];
        system: SystemStats | null; checked_at?: string;
      };
      systemHistory?: { samples?: SysSample[] };
      history?: Record<string, HistoryStats>;
    } | null;

    if (data?.overview) {
      connected = true;
      syncedAt = data.syncedAt || "";
      overview = data.overview;
      systemHistory = data.systemHistory?.samples || [];
      history = data.history || {};
    }
  } catch {
    // no DB / not synced yet — return empty state
  }

  if (!overview) {
    return NextResponse.json({
      connected: false,
      syncedAt: "",
      message: "Homelab Monitor not connected yet. Set HOMELAB_MONITOR_URL on the bridge machine.",
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const servers = overview.servers || [];
  const services = overview.services || [];
  const containers = overview.containers || [];
  const system = overview.system;

  const serversUp = servers.filter(s => s.alive).length;
  const servicesUp = services.filter(s => s.status === "up").length;
  const runningContainers = containers.filter(c => c.state === "running").length;

  const serverHistory = Object.fromEntries(
    Object.entries(history).filter(([k]) => k.startsWith("server:"))
  );
  const serviceHistory = Object.fromEntries(
    Object.entries(history).filter(([k]) => k.startsWith("service:"))
  );

  return NextResponse.json({
    connected,
    syncedAt,
    checkedAt: overview.checked_at || "",
    counts: {
      servers: servers.length, serversUp,
      services: services.length, servicesUp,
      containers: containers.length, runningContainers,
    },
    servers,
    services,
    containers: containers.slice(0, 60),
    system,
    systemHistory: {
      cpu: summarize(systemHistory, "cpu"),
      memory: summarize(systemHistory, "memory_used_percent"),
      disk: summarize(systemHistory, "disk_used_percent"),
    },
    serverHistory,
    serviceHistory,
  }, { headers: { "Cache-Control": "no-store" } });
}