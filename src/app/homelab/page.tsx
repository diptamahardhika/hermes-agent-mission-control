"use client";

import { useEffect, useState } from "react";
import {
  Server, Globe, Box, Cpu, MemoryStick, HardDrive, Wifi, ArrowUpRight, Activity,
} from "lucide-react";
import { Sparkline } from "@/components/sparkline";

interface ServerStatus {
  name: string; host: string; port: number; type: string;
  alive: boolean; latency: string; error?: string;
}
interface ServiceStatus {
  name: string; url: string; type: string; status: string;
  status_code?: number; latency: string; error?: string; resolved_ip?: string;
}
interface Container {
  id: string; name: string; image: string; state: string;
  status: string; ports: string; created: number;
}
interface SystemStats {
  hostname: string; os: string; kernel: string; uptime: string;
  cpu_count: number; cpu_usage_percent: number;
  memory_total_mb: number; memory_used_mb: number;
  memory_used_percent: number;
  disk_total_gb: number; disk_used_gb: number;
  disk_used_percent: number;
  network_rx_speed: number; network_tx_speed: number; ip_address: string;
}
interface HistoryStats {
  uptime_percent: number; last_down: string; samples: number;
  up_samples: number; state: string;
}

interface HomelabData {
  connected: boolean;
  syncedAt: string;
  checkedAt: string;
  counts: {
    servers: number; serversUp: number;
    services: number; servicesUp: number;
    containers: number; runningContainers: number;
  };
  servers: ServerStatus[];
  services: ServiceStatus[];
  containers: Container[];
  system: SystemStats | null;
  systemHistory: { cpu: number[]; memory: number[]; disk: number[] };
  serverHistory: Record<string, HistoryStats>;
  serviceHistory: Record<string, HistoryStats>;
}

const EMPTY: HomelabData = {
  connected: false, syncedAt: "", checkedAt: "",
  counts: { servers: 0, serversUp: 0, services: 0, servicesUp: 0, containers: 0, runningContainers: 0 },
  servers: [], services: [], containers: [], system: null,
  systemHistory: { cpu: [], memory: [], disk: [] },
  serverHistory: {}, serviceHistory: {},
};

function timeAgo(d: string) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtBytesPerSec(v: number) {
  if (!v) return "0 B/s";
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function fmtMB(mb: number) {
  if (mb >= 1024) return (mb / 1024).toFixed(1) + " GB";
  return Math.round(mb) + " MB";
}

function StatBox({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--hq-hairline)] bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-2 text-[var(--hq-text-ghost)]">
        <span className="opacity-80">{icon}</span>
        <span className="eyebrow !text-[10px]">{label}</span>
      </div>
      <div className="num text-[24px] font-semibold text-[var(--hq-text)] mt-1.5" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="num text-[10.5px] text-[var(--hq-text-ghost)] mt-0.5">{sub}</div>}
    </div>
  );
}

function ResourceChart({ label, data, color, suffix }: {
  label: string; data: number[]; color: string; suffix: string;
}) {
  const last = data.length ? data[data.length - 1] : 0;
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="eyebrow !text-[10px]">{label}</span>
        <span className="num text-[13px] font-semibold text-[var(--hq-text)]">{last.toFixed(1)}{suffix}</span>
      </div>
      {data.length > 1
        ? <Sparkline data={data} color={color} area idSeed={label} className="h-10" />
        : <div className="text-[12px] text-[var(--hq-text-ghost)]">Collecting history…</div>}
    </div>
  );
}

function UptimeBadge({ h }: { h: HistoryStats | undefined }) {
  if (!h) return <span className="text-[var(--hq-text-ghost)]">—</span>;
  return (
    <span className="num text-[11px]">
      <span className={h.state === "down" ? "text-[var(--hq-down)]" : "text-[var(--hq-up)]"}>
        {h.uptime_percent.toFixed(1)}%
      </span>
      {h.last_down && <span className="text-[var(--hq-text-ghost)]"> · down {timeAgo(h.last_down)}</span>}
    </span>
  );
}

export default function HomelabPage() {
  const [data, setData] = useState<HomelabData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/homelab")
        .then(r => r.ok ? r.json() : Promise.reject("fetch failed"))
        .then(d => {
          setData(d as HomelabData);
          setError(d?.message || null);
        })
        .catch(e => setError(String(e)))
        .finally(() => setLoading(false));
    load();
    const iv = setInterval(load, 30 * 1000);
    return () => clearInterval(iv);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-[var(--hq-hairline)] border-t-[var(--accent)] rounded-full animate-spin mb-4" />
        <p className="text-[var(--hq-text-ghost)] text-[13px]">Loading homelab status…</p>
      </div>
    );
  }

  if (!data.connected) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Server className="w-10 h-10 text-[var(--hq-text-ghost)] mb-4" />
        <p className="text-[var(--hq-text-dim)] text-[13px]">{error || "Homelab Monitor not connected"}</p>
        <p className="text-[var(--hq-text-ghost)] text-[11px] mt-2">
          Set HOMELAB_MONITOR_URL (+ HOMELAB_MONITOR_TOKEN) on the bridge machine and restart it.
        </p>
      </div>
    );
  }

  const c = data.counts;
  const allUp = c.servers > 0 && c.serversUp === c.servers && c.servicesUp === c.services;
  const system = data.system;

  return (
    <div className="mx-auto max-w-6xl">
      {/* ── Status banner ─────────────────────────────────────── */}
      <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 mt-4 ${
        allUp
          ? "border-emerald-500/20 bg-emerald-500/5"
          : c.servers === 0
          ? "border-[var(--hq-hairline)] bg-white/[0.02]"
          : "border-rose-500/20 bg-rose-500/5"
      }`}>
        <span className="relative flex w-2.5 h-2.5">
          <span className={`absolute inline-flex h-full w-full rounded-full animate-ping opacity-50 ${allUp ? "bg-emerald-400" : "bg-rose-400"}`} />
          <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${allUp ? "bg-emerald-400" : "bg-rose-400"}`} />
        </span>
        <span className="text-[13px] font-medium text-[var(--hq-text-dim)]">
          {c.servers === 0 ? "No servers configured" : allUp ? "All systems operational" : "Incidents detected"}
        </span>
        <span className="ml-auto num text-[11px] text-[var(--hq-text-ghost)]">
          {data.checkedAt ? `checked ${timeAgo(data.checkedAt)}` : ""}
        </span>
      </div>

      {/* ── Stat cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <StatBox icon={<Server className="w-4 h-4" />} label="Servers" value={`${c.serversUp}/${c.servers}`}
          sub="up / total" color={c.serversUp === c.servers && c.servers > 0 ? "var(--hq-up)" : "var(--hq-down)"} />
        <StatBox icon={<Globe className="w-4 h-4" />} label="Services" value={`${c.servicesUp}/${c.services}`}
          sub="up / total" color={c.servicesUp === c.services && c.services > 0 ? "var(--hq-up)" : "var(--hq-down)"} />
        <StatBox icon={<Box className="w-4 h-4" />} label="Containers" value={`${c.runningContainers}/${c.containers}`}
          sub="running / total" color={c.runningContainers > 0 ? "var(--accent)" : undefined} />
        <StatBox icon={<Cpu className="w-4 h-4" />} label="Host CPU" value={system ? `${system.cpu_usage_percent.toFixed(1)}%` : "—"}
          sub={system ? `${system.hostname} · ${system.os}` : ""} color={system ? "var(--accent)" : undefined} />
      </div>

      {/* ── System resources ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <ResourceChart label="CPU" data={data.systemHistory.cpu} color="#38bdf8" suffix="%" />
        <ResourceChart label="Memory" data={data.systemHistory.memory} color="#a78bfa" suffix="%" />
        <ResourceChart label="Disk" data={data.systemHistory.disk} color="#34d399" suffix="%" />
      </div>

      {/* ── System detail strip ───────────────────────────────── */}
      {system && (
        <div className="panel p-5 mt-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--accent)]" />
              <div>
                <div className="eyebrow !text-[10px]">Uptime</div>
                <div className="num text-[13px] font-medium text-[var(--hq-text)]">{system.uptime}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MemoryStick className="w-4 h-4 text-[var(--hq-text-ghost)]" />
              <div>
                <div className="eyebrow !text-[10px]">Memory</div>
                <div className="num text-[13px] font-medium text-[var(--hq-text)]">
                  {fmtMB(system.memory_used_mb)} / {fmtMB(system.memory_total_mb)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[var(--hq-text-ghost)]" />
              <div>
                <div className="eyebrow !text-[10px]">Disk</div>
                <div className="num text-[13px] font-medium text-[var(--hq-text)]">
                  {system.disk_used_gb} GB / {system.disk_total_gb} GB
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-[var(--hq-text-ghost)]" />
              <div>
                <div className="eyebrow !text-[10px]">Network</div>
                <div className="num text-[13px] font-medium text-[var(--hq-text)]">
                  ↓ {fmtBytesPerSec(system.network_rx_speed)} · ↑ {fmtBytesPerSec(system.network_tx_speed)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Servers ───────────────────────────────────────────── */}
      <div className="panel mt-4 overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Server className="w-4 h-4 text-[var(--accent)]" />
          <span className="eyebrow">Servers</span>
          <span className="num text-[11px] text-[var(--hq-text-ghost)]">{c.servers}</span>
        </div>
        {data.servers.length === 0 ? (
          <p className="text-[var(--hq-text-ghost)] text-[13px] px-5 pb-5">No servers configured.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--hq-hairline)]">
                <th className="px-5 py-2 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">Name</th>
                <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">Target</th>
                <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">Status</th>
                <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">Latency</th>
                <th className="px-5 py-2 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)] text-right">Uptime (30d)</th>
              </tr>
            </thead>
            <tbody>
              {data.servers.map(s => (
                <tr key={s.name} className="border-b border-[var(--hq-hairline)] last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-[13px] font-medium text-[var(--hq-text)]">{s.name}</td>
                  <td className="px-3 py-3 num text-[12px] text-[var(--hq-text-ghost)]">{s.host}:{s.port}</td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.alive ? "var(--hq-up)" : "var(--hq-down)" }} />
                      <span className={`text-[12px] font-medium ${s.alive ? "text-[var(--hq-up)]" : "text-[var(--hq-down)]"}`}>
                        {s.alive ? "up" : "down"}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-3 num text-[12px] text-[var(--hq-text-dim)]">{s.latency}</td>
                  <td className="px-5 py-3 text-right">
                    <UptimeBadge h={data.serverHistory[`server:${s.name}`]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Services ──────────────────────────────────────────── */}
      <div className="panel mt-4 overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Globe className="w-4 h-4 text-[var(--accent)]" />
          <span className="eyebrow">Services</span>
          <span className="num text-[11px] text-[var(--hq-text-ghost)]">{c.services}</span>
        </div>
        {data.services.length === 0 ? (
          <p className="text-[var(--hq-text-ghost)] text-[13px] px-5 pb-5">No services configured.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--hq-hairline)]">
                <th className="px-5 py-2 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">Name</th>
                <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">URL</th>
                <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">Status</th>
                <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">Latency</th>
                <th className="px-5 py-2 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)] text-right">Uptime (30d)</th>
              </tr>
            </thead>
            <tbody>
              {data.services.map(s => {
                const up = s.status === "up";
                return (
                  <tr key={s.name} className="border-b border-[var(--hq-hairline)] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-[13px] font-medium text-[var(--hq-text)]">{s.name}</td>
                    <td className="px-3 py-3">
                      <a href={s.url} target="_blank" rel="noreferrer"
                        className="num text-[12px] text-[var(--hq-text-ghost)] hover:text-[var(--hq-text)] flex items-center gap-1 group">
                        {s.url.replace(/^https?:\/\//, "")}
                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: up ? "var(--hq-up)" : "var(--hq-warn)" }} />
                        <span className={`text-[12px] font-medium ${up ? "text-[var(--hq-up)]" : "text-[var(--hq-warn)]"}`}>{s.status}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 num text-[12px] text-[var(--hq-text-dim)]">{s.latency}</td>
                    <td className="px-5 py-3 text-right">
                      <UptimeBadge h={data.serviceHistory[`service:${s.name}`]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Containers ────────────────────────────────────────── */}
      <div className="panel mt-4 overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Box className="w-4 h-4 text-[var(--accent)]" />
          <span className="eyebrow">Containers</span>
          <span className="num text-[11px] text-[var(--hq-text-ghost)]">{c.containers}</span>
        </div>
        {data.containers.length === 0 ? (
          <p className="text-[var(--hq-text-ghost)] text-[13px] px-5 pb-5">No containers.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--hq-hairline)]">
                <th className="px-5 py-2 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">Name</th>
                <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">Image</th>
                <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">Status</th>
                <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">Ports</th>
              </tr>
            </thead>
            <tbody>
              {data.containers.map(c => (
                <tr key={c.id} className="border-b border-[var(--hq-hairline)] last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-[13px] font-medium text-[var(--hq-text)]">{c.name}</td>
                  <td className="px-3 py-3 num text-[11px] text-[var(--hq-text-ghost)]">{c.image}</td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.state === "running" ? "var(--hq-up)" : "var(--hq-text-faint)" }} />
                      <span className={`text-[12px] font-medium ${c.state === "running" ? "text-[var(--hq-up)]" : "text-[var(--hq-text-ghost)]"}`}>
                        {c.status}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-3 num text-[11px] text-[var(--hq-text-ghost)]">{c.ports || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 text-center text-[11px] text-[var(--hq-text-ghost)]">
        Mirrored from homelab-monitor by the bridge · refreshes every 30s
      </div>
    </div>
  );
}