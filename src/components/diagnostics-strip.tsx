"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/kit";

interface DiagnosticsResult {
  [taskId: string]: string;
}

const DIAGNOSTIC_TASK_IDS = [
  "t_1562a80a", "t_09b132b9", "t_c94938e7", "t_85a6deff",
  "t_cc301918", "t_cc2be007",
];
const DIAGNOSTIC_IDS_QUERY = DIAGNOSTIC_TASK_IDS.join(",");

export function DiagnosticsStrip() {
  const [results, setResults] = useState<DiagnosticsResult>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/hermes/tasks/diagnostics?ids=${DIAGNOSTIC_IDS_QUERY}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => {
        setResults(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const entries = Object.entries(results);
  if (loading) return <Panel className="p-4"><span className="text-[11px] text-[var(--hq-text-ghost)]">Loading diagnostics...</span></Panel>;
  if (entries.length === 0) return null;

  return (
    <Panel className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-semibold text-[var(--hq-text)]">Diagnostics</span>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--hq-up)]" />
      </div>
      <div className="space-y-1">
        {entries.map(([id, error]) => (
          <div key={id} className="flex items-center gap-2 text-[11px]">
            <span className="font-mono text-[var(--hq-text-ghost)] truncate">{id}</span>
            {error ? (
              <span className="font-semibold text-[var(--hq-down)] truncate">{error}</span>
            ) : (
              <span className="text-[var(--hq-text-ghost)] opacity-60">ok</span>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
