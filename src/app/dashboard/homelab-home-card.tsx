"use client";

import { useState, useEffect } from "react";
import { Server, Box, Cpu, MemoryStick, HardDrive, ArrowUpRight } from "lucide-react";

function PanelSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse space-y-3 ${className}`}><div className="h-4 bg-[var(--hq-card)] rounded w-3/4" /><div className="h-4 bg-[var(--hq-card)] rounded w-1/2" /><div className="h-4 bg-[var(--hq-card)] rounded w-5/6" /></div>;
}
function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

interface HomelabData {
  counts: { servers: number; serversUp: number; services: number; servicesUp: number };
  system: { hostname: string; uptime: string; cpu_usage_percent: number; memory_used_percent: number; disk_used_percent: number } | null;
  connected: boolean;
  checkedAt: string | undefined;
}

export function HomelabHomeCard({ homelab }: { homelab: HomelabData }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(false); }, []);
  const c = homelab.counts;
  const sys = homelab.system;
  const allUp = c.servers > 0 && c.serversUp === c.servers && c.servicesUp === c.services;

  const bar = (pct: number, color: string) => (
    <div className="h-[4px] flex-1 rounded-full bg-white/[0.06] overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color, transition: "width 1s var(--ease)" }} />
    </div>
  );

  return (
    <div className="panel flex flex-col p-6 flex-1">
      {loading && <PanelSkeleton />}
      {/* Status header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex w-2 h-2">
          <span className="absolute inline-flex h-full w-full rounded-full animate-ping opacity-50" style={{ background: allUp ? "var(--hq-up)" : "var(--hq-down)" }} />
          <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: allUp ? "var(--hq-up)" : "var(--hq-down)" }} />
        </span>
        <span className="eyebrow">Homelab</span>
        <span className="ml-auto num text-[10px] text-[var(--hq-text-ghost)]">
          {homelab.checkedAt ? `${timeAgo(homelab.checkedAt)}` : ""}
        </span>
      </div>

      {!homelab.connected ? (
        <>
          <p className="text-[13px] text-[var(--hq-text-dim)]">Not connected</p>
          <p className="text-[11px] text-[var(--hq-text-ghost)] mt-1 leading-snug">
            Set HOMELAB_MONITOR_URL on the bridge to start mirroring.
          </p>
        </>
      ) : (
        <>
          {/* Status + host */}
          <div className="mb-4">
            <div className="text-[15px] font-semibold text-[var(--hq-text)] tracking-tight">
              {allUp ? "All systems operational" : "Incidents detected"}
            </div>
            <div className="num text-[11px] text-[var(--hq-text-ghost)] mt-0.5">
              {sys ? `${sys.hostname} · up ${sys.uptime}` : ""}
            </div>
          </div>

          {/* Servers + services big numbers */}
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div className="rounded-lg border border-[var(--hq-hairline)] bg-white/[0.02] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-[var(--hq-text-ghost)] shrink-0" />
                <span className="eyebrow !text-[9px]">Servers</span>
              </div>
              <div className="num text-[20px] font-semibold mt-1" style={{ color: allUp ? "var(--hq-up)" : "var(--hq-down)" }}>
                {c.serversUp}<span className="text-[13px] text-[var(--hq-text-ghost)] font-normal">/{c.servers}</span>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--hq-hairline)] bg-white/[0.02] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Box className="w-3.5 h-3.5 text-[var(--hq-text-ghost)] shrink-0" />
                <span className="eyebrow !text-[9px]">Services</span>
              </div>
              <div className="num text-[20px] font-semibold mt-1" style={{ color: c.servicesUp === c.services ? "var(--hq-up)" : "var(--hq-warn)" }}>
                {c.servicesUp}<span className="text-[13px] text-[var(--hq-text-ghost)] font-normal">/{c.services}</span>
              </div>
            </div>
          </div>

          {/* Host resources */}
          {sys && (
            <div className="space-y-2.5 mt-auto">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">
                    <Cpu className="w-3 h-3" /> CPU
                  </span>
                  <span className="num text-[10.5px] text-[var(--hq-text-dim)]">{sys.cpu_usage_percent.toFixed(0)}%</span>
                </div>
                {bar(sys.cpu_usage_percent, "#38bdf8")}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">
                    <MemoryStick className="w-3 h-3" /> RAM
                  </span>
                  <span className="num text-[10.5px] text-[var(--hq-text-dim)]">{sys.memory_used_percent.toFixed(0)}%</span>
                </div>
                {bar(sys.memory_used_percent, "#a78bfa")}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--hq-text-ghost)]">
                    <HardDrive className="w-3 h-3" /> Disk
                  </span>
                  <span className="num text-[10.5px] text-[var(--hq-text-dim)]">{sys.disk_used_percent.toFixed(0)}%</span>
                </div>
                {bar(sys.disk_used_percent, "#34d399")}
              </div>
            </div>
          )}
        </>
      )}

      <a
        href="/homelab"
        className="mt-3 pt-3 flex items-center gap-1 text-[var(--hq-text-faint)] text-[11px] font-medium hover:text-[var(--hq-text-dim)] transition-colors group border-t border-[var(--hq-hairline)]"
      >
        Open Homelab dashboard
        <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </a>
    </div>
  );
}
