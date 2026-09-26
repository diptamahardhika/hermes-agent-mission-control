"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Panel, Button, Skeleton, EmptyState, Pill } from "@/components/ui/kit";
import { AccessibleTabList, AccessibleTabPanel } from "@/components/accessible-tabs";

function TabSkeleton() {
  return (
    <div className="space-y-4 pt-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="panel p-5 space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

const LongformTab = dynamic(() => import("@/app/longform/page"), { ssr: false, loading: () => <TabSkeleton /> });
const OutlierFeed = dynamic(() => import("@/components/OutlierFeed"), { ssr: false, loading: () => <TabSkeleton /> });

interface Idea {
  title: string;
  hook: string;
  angle: string;
  hookType?: string;
  funnelStage?: string;
  rejectedReason?: string;
  status?: "pending" | "rejected" | "approved";
  sourceUrl?: string;
  sourceSummary?: string;
}

interface Script {
  id: string;
  title: string;
  hook: string;
  storySetup: string;
  conflict: string;
  insight: string;
  cta: string;
  caption: string;
  onScreenText?: string;
  hookType?: string;
  funnelStage?: string;
  rejectedReason?: string;
  factCheck?: { status: string; verified: number; issues: string[]; sourceUrls?: string[] };
  fullScript?: string;
  status: "draft" | "approved" | "tofilm" | "filmed" | "rejected";
  createdAt: string;
  // SEO Package
  seoTitle?: string;
  seoDescription?: string;
  seoTags?: string[];
  seoChapters?: { time: string; label: string }[];
  titleVariants?: string[];
  thumbnailConcept?: string;
}

// funnel stage tone: TOF = accent, MOF = warn, BOF = up
function funnelTone(stage?: string): "accent" | "warn" | "up" {
  if (stage === "TOF") return "accent";
  if (stage === "MOF") return "warn";
  return "up";
}

export default function YouTubePage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [rejectedIdeas, setRejectedIdeas] = useState<Idea[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatedScript, setGeneratedScript] = useState<Script | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [activeView, setActiveView] = useState<"longform" | "shorts" | "performance" | "outliers">("longform");
  const [shortsView, setShortsView] = useState<"ideas" | "scripts" | "tofilm" | "filmed">("ideas");
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [selectedIdeas, setSelectedIdeas] = useState<Set<string>>(new Set());
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [ideaTab, setIdeaTab] = useState<"pending" | "rejected">("pending");
  const [scriptTab, setScriptTab] = useState<"draft" | "rejected">("draft");
  const [rejectModal, setRejectModal] = useState<{ type: "idea" | "script"; id: string; title: string } | null>(null);
  const rejectRef = React.useRef<HTMLTextAreaElement>(null);

  // Performance tab state
  type PerfVideo = { id: string; title: string; thumbnail: string; publishedAt: string; views: number; likes: number; comments: number; url: string; isShort: boolean; durationSecs: number; };
  const [perfData, setPerfData] = useState<{ videos: PerfVideo[]; totalVideos: number; avgViews: number; avgEngagement: number } | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfFilter, setPerfFilter] = useState<"all" | "30" | "90">("all");
  const [perfVideoType, setPerfVideoType] = useState<"all" | "longform" | "shorts">("all");
  const [perfSort, setPerfSort] = useState<"views" | "likes" | "comments" | "publishedAt">("views");
  const [perfSortDir, setPerfSortDir] = useState<"desc" | "asc">("desc");

  const fetchPerformance = useCallback(async () => {
    if (perfData) return;
    setPerfLoading(true);
    try {
      const d = await (await fetch("/api/youtube/performance", { cache: "no-store" })).json();
      setPerfData(d);
    } catch { /* empty */ }
    setPerfLoading(false);
  }, [perfData]);

  useEffect(() => {
    if (activeView === "performance") fetchPerformance();
  }, [activeView, fetchPerformance]);

  function fmtNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  }

  function fmtPubDate(s: string): string {
    return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const fetchIdeas = useCallback(async () => {
    try {
      const all: Idea[] = await (await fetch("/api/youtube/ideas", { cache: "no-store" })).json();
      setIdeas(all.filter(i => !i.status || i.status === "pending"));
      setRejectedIdeas(all.filter(i => i.status === "rejected"));
    } catch { /* empty */ }
  }, []);

  const fetchScripts = useCallback(async () => {
    try { setScripts(await (await fetch("/api/youtube/scripts", { cache: "no-store" })).json()); } catch { /* empty */ }
  }, []);

  useEffect(() => { fetchIdeas(); fetchScripts(); }, [fetchIdeas, fetchScripts]);

  async function generateFromIdea(idea: Idea) {
    setGenerating(idea.title);
    setGeneratedScript(null);
    try {
      const res = await fetch("/api/youtube/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: `${idea.title}. Hook angle: ${idea.hook}. Lesson: ${idea.angle}`, sourceUrl: idea.sourceUrl, sourceSummary: idea.sourceSummary }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedScript(data);
        await fetch("/api/youtube/scripts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        // Mark idea as approved
        await fetch("/api/youtube/ideas/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: idea.title, status: "approved" }),
        });
        setIdeas(prev => prev.filter(i => i.title !== idea.title));
        fetchScripts();
      }
    } catch { /* empty */ }
    setGenerating(null);
  }

  async function rejectIdea(title: string, reason: string) {
    try {
      await fetch("/api/youtube/ideas/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status: "rejected", rejectedReason: reason }),
      });
      const idea = ideas.find(i => i.title === title);
      if (idea) {
        setIdeas(prev => prev.filter(i => i.title !== title));
        setRejectedIdeas(prev => [...prev, { ...idea, status: "rejected", rejectedReason: reason }]);
      }
    } catch { /* empty */ }
  }

  async function updateScript(id: string, updates: Partial<Script>) {
    try {
      await fetch("/api/youtube/scripts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      setScripts(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      if (generatedScript?.id === id) setGeneratedScript(prev => prev ? { ...prev, ...updates } : null);
    } catch { /* empty */ }
  }

  async function deleteScript(id: string) {
    try {
      await fetch("/api/youtube/scripts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, deleted: true }),
      });
      setScripts(prev => prev.filter(s => s.id !== id));
    } catch { /* empty */ }
  }

  const draftScripts = scripts.filter(s => s.status === "draft");
  const approvedScripts = scripts.filter(s => s.status === "approved");
  const rejectedScripts = scripts.filter(s => s.status === "rejected");
  const tofilmScripts = scripts.filter(s => s.status === "tofilm");
  const filmedScripts = scripts.filter(s => s.status === "filmed");

  // small ghost copy button
  const copyBtn = "text-[10px] px-2 py-0.5 rounded-[var(--r-sm)] bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--line)] hover:text-[var(--text)] transition-colors";

  function RejectModal() {
    if (!rejectModal) return null;
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6" onClick={() => setRejectModal(null)}>
        <div dir="ltr" className="panel p-4 md:p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
          <h3 className="text-sm font-semibold text-[var(--text)] mb-1">Reject: {rejectModal.title}</h3>
          <p className="text-xs text-[var(--text-3)] mb-3">Why? This helps me learn your taste.</p>
          <textarea
            ref={rejectRef}
            defaultValue=""
            placeholder="e.g. hook is weak, story is overdone, not my angle..."
            className="w-full bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-md)] p-3 text-sm text-[var(--text)] placeholder-[var(--text-3)] resize-none h-20 focus:outline-none focus:border-[var(--accent)]"
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                const reason = rejectRef.current?.value || "";
                if (rejectModal.type === "idea") rejectIdea(rejectModal.id, reason);
                else updateScript(rejectModal.id, { status: "rejected", rejectedReason: reason } as Partial<Script>);
                setRejectModal(null);
              }}
              className="flex-1 text-sm py-2 rounded-[var(--r-md)] font-medium transition-colors"
              style={{ color: "var(--down)", background: "color-mix(in srgb, var(--down) 14%, transparent)" }}
            >Reject</button>
            <button onClick={() => { setRejectModal(null); }} className="btn-ghost flex-1 text-sm py-2">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  function ScriptCard({ script, compact }: { script: Script; compact?: boolean }) {
    const [expanded, setExpanded] = useState(!compact);

    const fcTone = script.factCheck?.status === "✅" ? "var(--up)" : script.factCheck?.status === "🔧" ? "var(--warn)" : "var(--down)";

    return (
      <Panel className="overflow-hidden !p-0">
        <div className="p-4 md:p-6 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[var(--text)] flex-1 pr-2">{script.title}</span>
            <div className="flex items-center gap-2 shrink-0">
              {script.funnelStage && <Pill tone={funnelTone(script.funnelStage)} className="!px-2 !py-0.5 !text-[10px]">{script.funnelStage}</Pill>}
              {script.hookType && <Pill tone="neutral" className="!px-2 !py-0.5 !text-[10px]">{script.hookType}</Pill>}
              <span className="text-[10px] text-[var(--text-4)]">{expanded ? "▴" : "▾"}</span>
            </div>
          </div>
          {script.factCheck && (
            <div className="rounded-[var(--r-md)] p-2 mb-2 border" style={{ borderColor: `color-mix(in srgb, ${fcTone} 22%, transparent)`, background: `color-mix(in srgb, ${fcTone} 10%, transparent)` }}>
              <p className="text-[11px] text-[var(--text-2)]">
                <span className="font-medium text-[var(--text)]">{script.factCheck.status} Fact Check</span>
                {script.factCheck.status === "✅" && <span className="num ml-1" style={{ color: "var(--up)" }}>— {script.factCheck.verified} claims verified</span>}
                {script.factCheck.status === "🔧" && <span className="ml-1" style={{ color: "var(--warn)" }}>— auto-corrected</span>}
                {script.factCheck.status === "⚠️" && <span className="ml-1" style={{ color: "var(--down)" }}>— issues found</span>}
              </p>
              {script.factCheck.issues.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {script.factCheck.issues.map((issue, i) => (
                    <p key={i} className="text-[10px]" style={{ color: "var(--warn)" }}>• {issue}</p>
                  ))}
                </div>
              )}
              {script.factCheck.sourceUrls && script.factCheck.sourceUrls.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-[var(--line)]">
                  <p className="text-[9px] text-[var(--text-3)] mb-0.5">📚 Sources:</p>
                  {script.factCheck.sourceUrls.slice(0, 5).map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-[9px] truncate hover:underline" style={{ color: "var(--accent)" }}>🔗 {url}</a>
                  ))}
                </div>
              )}
            </div>
          )}
          {script.rejectedReason && (
            <div className="rounded-[var(--r-md)] p-2 mb-2 border" style={{ borderColor: "color-mix(in srgb, var(--down) 22%, transparent)", background: "color-mix(in srgb, var(--down) 10%, transparent)" }}>
              <p className="text-[10px]" style={{ color: "var(--down)" }}>💬 {script.rejectedReason}</p>
            </div>
          )}
          {script.onScreenText && (
            <div className="bg-[var(--surface-2)] rounded-[var(--r-md)] p-2 mb-2 border border-[var(--line)]">
              <p className="eyebrow mb-0.5">📺 On-Screen Text</p>
              <p className="text-[12px] text-[var(--text-2)] font-medium">{script.onScreenText}</p>
            </div>
          )}
          <div className="bg-[var(--surface-2)] rounded-[var(--r-md)] p-3 border border-[var(--line)]">
            <p className="eyebrow mb-1">Hook</p>
            <p className="text-[13px] text-[var(--text)] whitespace-pre-line leading-relaxed">{script.hook}</p>
          </div>
        </div>

        {expanded && (
          <div className="px-4 pb-4 space-y-3">
            {[
              { label: "Story Setup", text: script.storySetup },
              { label: "Conflict / Pivot", text: script.conflict },
              { label: "Insight / Payoff", text: script.insight },
              { label: "CTA", text: script.cta },
              { label: "Caption", text: script.caption },
            ].map(s => (
              <div key={s.label} className="bg-[var(--surface-2)] rounded-[var(--r-md)] p-3">
                <p className="eyebrow mb-1">{s.label}</p>
                <p className={`text-[13px] text-[var(--text-2)] whitespace-pre-line leading-relaxed ${s.label === "Caption" ? "italic" : ""}`}>{s.text}</p>
              </div>
            ))}
            {/* SEO Package */}
            {(script.seoTitle || script.titleVariants || script.seoTags) && (
              <div className="bg-[var(--surface-2)] rounded-[var(--r-lg)] border border-[var(--line)] p-4 space-y-3">
                <p className="eyebrow" style={{ color: "var(--accent)" }}>🔍 SEO Package</p>

                {script.titleVariants && script.titleVariants.length > 0 && (
                  <div>
                    <p className="eyebrow mb-1.5">Title Variants</p>
                    <div className="space-y-1">
                      {script.titleVariants.map((v, i) => (
                        <div key={i} className="flex items-start gap-2 group">
                          <span className="num text-[10px] text-[var(--text-4)] w-4 shrink-0 mt-0.5">{i + 1}.</span>
                          <p className="text-[12px] text-[var(--text-2)] flex-1">{v}</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(v); }}
                            className={`opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${copyBtn}`}
                          >copy</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {script.seoTitle && (
                  <div>
                    <p className="eyebrow mb-1">Optimized Title</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-medium flex-1" style={{ color: "var(--accent)" }}>{script.seoTitle}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(script.seoTitle!); }}
                        className={copyBtn}
                      >copy</button>
                    </div>
                    <p className="num text-[10px] text-[var(--text-4)] mt-0.5">{script.seoTitle.length}/60 chars</p>
                  </div>
                )}

                {script.seoDescription && (
                  <div>
                    <p className="eyebrow mb-1">Description</p>
                    <div className="flex items-start gap-2">
                      <p className="text-[11px] text-[var(--text-2)] whitespace-pre-line leading-relaxed flex-1">{script.seoDescription}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(script.seoDescription!); }}
                        className={`shrink-0 ${copyBtn}`}
                      >copy</button>
                    </div>
                  </div>
                )}

                {script.seoTags && script.seoTags.length > 0 && (
                  <div>
                    <p className="eyebrow mb-1.5">Tags (<span className="num">{script.seoTags.length}</span>)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {script.seoTags.map((tag, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-3)] text-[var(--text-2)] border border-[var(--line)]">{tag}</span>
                      ))}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(script.seoTags!.join(', ')); }}
                      className={`mt-1.5 ${copyBtn}`}
                    >📋 Copy all tags</button>
                  </div>
                )}

                {script.seoChapters && script.seoChapters.length > 0 && (
                  <div>
                    <p className="eyebrow mb-1.5">Chapters</p>
                    <div className="space-y-0.5">
                      {script.seoChapters.map((ch, i) => (
                        <p key={i} className="num text-[11px] text-[var(--text-2)] font-mono">{ch.time} {ch.label}</p>
                      ))}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(script.seoChapters!.map(c => `${c.time} ${c.label}`).join('\n')); }}
                      className={`mt-1.5 ${copyBtn}`}
                    >📋 Copy chapters</button>
                  </div>
                )}

                {script.thumbnailConcept && (
                  <div>
                    <p className="eyebrow mb-1">Thumbnail Concept</p>
                    <p className="text-[11px] text-[var(--text-2)] italic">{script.thumbnailConcept}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="ghost"
                onClick={() => {
                  const full = `${script.hook}\n\n${script.storySetup}\n\n${script.conflict}\n\n${script.insight}\n\n${script.cta}`;
                  navigator.clipboard.writeText(full);
                }}
              >📋 Copy</Button>

              {script.status === "draft" && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); updateScript(script.id, { status: "tofilm" }); }}
                    className="text-xs px-3 py-1.5 rounded-[var(--r-md)] font-medium transition-colors"
                    style={{ color: "var(--up)", background: "color-mix(in srgb, var(--up) 12%, transparent)" }}
                  >Approve</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRejectModal({ type: "script", id: script.id, title: script.title }); }}
                    className="text-xs px-3 py-1.5 rounded-[var(--r-md)] transition-colors"
                    style={{ color: "var(--down)", background: "color-mix(in srgb, var(--down) 12%, transparent)" }}
                  >Reject</button>
                </>
              )}

              {script.status === "tofilm" && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); updateScript(script.id, { status: "filmed" }); }}
                    className="text-xs px-3 py-1.5 rounded-[var(--r-md)] font-medium transition-colors"
                    style={{ color: "var(--up)", background: "color-mix(in srgb, var(--up) 12%, transparent)" }}
                  >Filmed</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteScript(script.id); }}
                    className="text-xs px-3 py-1.5 rounded-[var(--r-md)] transition-colors"
                    style={{ color: "var(--down)", background: "color-mix(in srgb, var(--down) 12%, transparent)" }}
                  >🗑 Delete</button>
                  <Button size="sm" variant="ghost" onClick={() => updateScript(script.id, { status: "draft" })}>↩ Back to Scripts</Button>
                </>
              )}

              {script.status === "filmed" && (
                <Button size="sm" variant="ghost" onClick={() => updateScript(script.id, { status: "tofilm" })}>↩ Back to To Film</Button>
              )}

              {script.status === "rejected" && (
                <Button size="sm" variant="ghost" onClick={() => updateScript(script.id, { status: "draft" })}>↩ Restore to Draft</Button>
              )}
            </div>
          </div>
        )}
      </Panel>
    );
  }

  // shorts sub-nav pill styling
  function subPill(active: boolean) {
    return `text-xs px-3 py-1.5 rounded-full transition-colors ${active ? "" : "bg-[var(--surface-1)] text-[var(--text-3)] hover:text-[var(--text-2)] border border-[var(--line)]"}`;
  }
  const subActiveStyle = { color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)" };

  return (
    <div dir="ltr" className="min-h-screen pt-16 md:pt-6 px-4 md:p-6 space-y-6">
      <RejectModal />

      {/* Main Tabs */}
      <AccessibleTabList
        idPrefix="youtube-main"
        panelId="youtube-main-panel"
        ariaLabel="YouTube views"
        tabs={[
          { key: "longform", label: "📹 Long Form" },
          { key: "shorts", label: "🎬 Shorts" },
          { key: "performance", label: "📊 Performance" },
          { key: "outliers", label: "🔥 Outliers" },
        ]}
        activeTab={activeView}
        onChange={setActiveView}
        className="flex items-center gap-0 border-b border-[var(--line)] overflow-x-auto"
        buttonClassName={(active) => `text-sm px-5 py-2.5 font-medium transition-colors relative whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${active ? "text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text-2)]"}`}
        activeIndicator={<span aria-hidden="true" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[var(--accent)]" />}
      />
      <AccessibleTabPanel id="youtube-main-panel" labelledBy={`youtube-main-tab-${activeView}`} className="space-y-6">
      {/* LONGFORM VIEW */}
      {activeView === "longform" && (
        <div className="[&>div]:min-h-0 [&>div]:pt-0 [&>div]:md\:pt-0 [&>div]:px-0 [&>div]:md\:px-0 [&>div]:p-0 [&>div]:md\:p-0">
          <LongformTab />
        </div>
      )}

      {/* SHORTS SUB-NAV */}
      {activeView === "shorts" && (
        <AccessibleTabList
          idPrefix="youtube-shorts"
          panelId="youtube-shorts-panel"
          ariaLabel="Shorts views"
          tabs={[
            { key: "ideas", label: <>💡 Ideas (<span className="num">{ideas.length}</span>)</> },
            { key: "scripts", label: <>📜 Scripts (<span className="num">{draftScripts.length}</span>)</> },
            { key: "tofilm", label: <>🎬 To Film (<span className="num">{tofilmScripts.length}</span>)</> },
            { key: "filmed", label: <>✅ Filmed (<span className="num">{filmedScripts.length}</span>)</> },
          ]}
          activeTab={shortsView}
          onChange={setShortsView}
          className="flex gap-2 mt-4 mb-2"
          buttonClassName={(active) => subPill(active)}
          buttonStyle={(active) => active ? subActiveStyle : undefined}
        />
      )}

      {activeView === "shorts" && (
        <AccessibleTabPanel id="youtube-shorts-panel" labelledBy={`youtube-shorts-tab-${shortsView}`}>
      {/* IDEAS VIEW */}
      {activeView === "shorts" && shortsView === "ideas" && (
        <div>
          {/* Sub-tabs */}
          <AccessibleTabList
            idPrefix="youtube-ideas"
            panelId="youtube-ideas-panel"
            ariaLabel="Idea status"
            tabs={[
              { key: "pending", label: <>Pending (<span className="num">{ideas.length}</span>)</> },
              { key: "rejected", label: <>Rejected (<span className="num">{rejectedIdeas.length}</span>)</> },
            ]}
            activeTab={ideaTab}
            onChange={setIdeaTab}
            className="flex gap-2 mb-4"
            buttonClassName={(active) => subPill(active)}
            buttonStyle={(active) => active ? subActiveStyle : undefined}
          />
          <AccessibleTabPanel id="youtube-ideas-panel" labelledBy={`youtube-ideas-tab-${ideaTab}`}>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:p-6">
              <div className="lg:col-span-3 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-[var(--text-3)]">{ideaTab === "pending" ? "Tap to select · hover for ✕ reject" : "Rejected ideas with your feedback"}</p>
                {ideaTab === "pending" && (
                  <div className="flex items-center gap-2">
                    {selectedIdeas.size > 0 && (
                      <Button size="sm" variant="primary" disabled={batchGenerating}
                        onClick={async () => {
                          setBatchGenerating(true);
                          for (const title of selectedIdeas) {
                            const idea = ideas.find(i => i.title === title);
                            if (idea) await generateFromIdea(idea);
                          }
                          setSelectedIdeas(new Set());
                          setBatchGenerating(false);
                        }}
                      >{batchGenerating ? `✨ Generating ${selectedIdeas.size}...` : `Generate ${selectedIdeas.size} Script${selectedIdeas.size > 1 ? "s" : ""}`}</Button>
                    )}
                    <Button size="sm" variant="ghost" disabled={generatingIdeas}
                      onClick={async () => {
                        setGeneratingIdeas(true);
                        try {
                          const res = await fetch("/api/youtube/ideas/generate", { method: "POST" });
                          if (res.ok) fetchIdeas();
                        } catch { /* empty */ }
                        setGeneratingIdeas(false);
                      }}
                    >{generatingIdeas ? "✨ Generating..." : "💡 More Ideas"}</Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(ideaTab === "pending" ? ideas : rejectedIdeas).map((idea, i) => {
                  const isSelected = selectedIdeas.has(idea.title);
                  const gen = generating === idea.title;
                  return (
                  <div
                    key={i}
                    className={`relative group text-left p-3 rounded-[var(--r-md)] border transition-all cursor-pointer ${
                      gen
                        ? "animate-pulse"
                        : ideaTab === "rejected"
                        ? "bg-[var(--surface-1)] border-[var(--line)] opacity-60"
                        : isSelected
                        ? ""
                        : "bg-[var(--surface-1)] border-[var(--line)] hover:bg-[var(--surface-2)]"
                    }`}
                    style={
                      gen
                        ? { background: "color-mix(in srgb, var(--accent) 10%, transparent)", borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)" }
                        : (ideaTab === "pending" && isSelected)
                        ? { background: "color-mix(in srgb, var(--up) 10%, transparent)", borderColor: "color-mix(in srgb, var(--up) 40%, transparent)" }
                        : undefined
                    }
                    onClick={() => {
                      if (ideaTab !== "pending" || generating === idea.title) return;
                      setSelectedIdeas(prev => {
                        const next = new Set(prev);
                        if (next.has(idea.title)) next.delete(idea.title);
                        else next.add(idea.title);
                        return next;
                      });
                    }}
                  >
                    {ideaTab === "pending" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setRejectModal({ type: "idea", id: idea.title, title: idea.title }); }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--surface-3)] text-[var(--text-3)] hover:text-[var(--down)] text-[10px] opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center z-10"
                      >✕</button>
                    )}
                    {isSelected && (
                      <div className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "var(--up)" }}>
                        <span className="text-[10px] text-[var(--bg)] font-bold">✓</span>
                      </div>
                    )}
                    <div className={isSelected ? "pl-5" : ""}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <p className="text-sm font-medium text-[var(--text)] pr-6">{idea.title}</p>
                      </div>
                      {(idea.hookType || idea.funnelStage) && (
                        <div className="flex gap-1 mb-1">
                          {idea.funnelStage && <Pill tone={funnelTone(idea.funnelStage)} className="!px-1.5 !py-0.5 !text-[9px]">{idea.funnelStage}</Pill>}
                          {idea.hookType && <Pill tone="neutral" className="!px-1.5 !py-0.5 !text-[9px]">{idea.hookType}</Pill>}
                        </div>
                      )}
                      <p className="text-[11px] text-[var(--text-3)] line-clamp-2 leading-relaxed">{idea.hook}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {idea.sourceUrl ? (
                          <a href={idea.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[9px] truncate max-w-[200px] hover:underline" style={{ color: "var(--accent)" }}>🔗 source</a>
                        ) : (
                          <span className="text-[9px]" style={{ color: "var(--warn)" }}>⚠️ unverified</span>
                        )}
                      </div>
                      {idea.rejectedReason && (
                        <p className="text-[10px] mt-1.5" style={{ color: "var(--down)" }}>💬 {idea.rejectedReason}</p>
                      )}
                      {gen && (
                        <p className="text-[10px] mt-2 font-medium" style={{ color: "var(--accent)" }}>✨ Writing script...</p>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Preview */}
            <div className="lg:col-span-2">
              <p className="eyebrow mb-3">Preview</p>
              {generatedScript ? (
                <ScriptCard script={generatedScript} />
              ) : (
                <Panel>
                  <EmptyState icon={<span className="text-3xl">✂️</span>} title="Pick an idea to generate a full script" />
                </Panel>
              )}
            </div>
          </div>
          </AccessibleTabPanel>
        </div>
      )}

      {/* SCRIPTS VIEW */}
      {activeView === "shorts" && shortsView === "scripts" && (
        <div>
          <AccessibleTabList
            idPrefix="youtube-scripts"
            panelId="youtube-scripts-panel"
            ariaLabel="Script status"
            tabs={[
              { key: "draft", label: <>Pending (<span className="num">{draftScripts.length}</span>)</> },
              { key: "rejected", label: <>Rejected (<span className="num">{rejectedScripts.length}</span>)</> },
            ]}
            activeTab={scriptTab}
            onChange={(tab) => setScriptTab(tab)}
            className="flex gap-2 mb-4"
            buttonClassName={(active) => subPill(active)}
            buttonStyle={(active) => active ? subActiveStyle : undefined}
          />
          <AccessibleTabPanel id="youtube-scripts-panel" labelledBy={`youtube-scripts-tab-${scriptTab}`}>
            <div className="space-y-3">
              {(scriptTab === "draft" ? draftScripts : rejectedScripts).length === 0 ? (
                <Panel>
                  <EmptyState title={`No ${scriptTab} scripts`} />
                </Panel>
              ) : (
                (scriptTab === "draft" ? draftScripts : rejectedScripts).map(s => <ScriptCard key={s.id} script={s} compact />)
              )}
            </div>
          </AccessibleTabPanel>
        </div>
      )}

      {/* TO FILM VIEW */}
      {activeView === "shorts" && shortsView === "tofilm" && (
        <div className="space-y-3">
          {tofilmScripts.length === 0 ? (
            <Panel>
              <EmptyState icon={<span className="text-3xl">🎬</span>} title="No scripts queued for filming" hint="Approve scripts to move them here" />
            </Panel>
          ) : (
            <>
              <Button size="sm" variant="ghost"
                onClick={() => {
                  const text = tofilmScripts.map((s, i) => {
                    const parts = [s.hook, s.storySetup, s.conflict, s.insight, s.cta].filter(Boolean);
                    return `Video ${i + 1}:\n${parts.join("\n\n")}`;
                  }).join("\n\n---\n\n");
                  navigator.clipboard.writeText(text);
                }}
              >📋 Copy All Scripts ({tofilmScripts.length})</Button>
              <button
                onClick={async () => {
                  for (const s of tofilmScripts) {
                    await fetch("/api/youtube/scripts", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: s.id, status: "filmed" }),
                    });
                  }
                  setScripts(prev => prev.map(s => s.status === "tofilm" ? { ...s, status: "filmed" } : s));
                }}
                className="text-xs px-4 py-2 rounded-[var(--r-md)] font-medium transition-colors ml-2"
                style={{ color: "var(--up)", background: "color-mix(in srgb, var(--up) 12%, transparent)" }}
              >✅ Mark All as Filmed ({tofilmScripts.length})</button>
              {tofilmScripts.map(s => <ScriptCard key={s.id} script={s} compact />)}
            </>
          )}
        </div>
      )}

      {/* FILMED VIEW */}
      {activeView === "shorts" && shortsView === "filmed" && (
        <div className="space-y-3">
          {filmedScripts.length === 0 ? (
            <Panel>
              <EmptyState icon={<span className="text-3xl">✅</span>} title="No filmed scripts yet" />
            </Panel>
          ) : (
            filmedScripts.map(s => <ScriptCard key={s.id} script={s} compact />)
          )}
        </div>
      )}
      </AccessibleTabPanel>
      )}

      {activeView === "outliers" && <OutlierFeed />}

      {/* PERFORMANCE VIEW */}
      {activeView === "performance" && (
        <div className="space-y-5">
          {perfLoading ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-[var(--r-md)]" />)}
              </div>
              <Skeleton className="h-64 rounded-[var(--r-md)]" />
            </div>
          ) : perfData ? (() => {
            // Filtering
            const dateFiltered = perfData.videos.filter(v => {
              if (perfFilter === "all") return true;
              const days = perfFilter === "30" ? 30 : 90;
              return new Date(v.publishedAt) >= new Date(Date.now() - days * 86400000);
            });
            const typeFiltered = dateFiltered.filter(v => {
              if (perfVideoType === "all") return true;
              if (perfVideoType === "shorts") return v.isShort;
              return !v.isShort;
            });
            const sorted = [...typeFiltered].sort((a, b) => {
              const aVal = perfSort === "publishedAt" ? new Date(a.publishedAt).getTime() : a[perfSort];
              const bVal = perfSort === "publishedAt" ? new Date(b.publishedAt).getTime() : b[perfSort];
              return perfSortDir === "desc" ? bVal - aVal : aVal - bVal;
            });

            const longformCount = dateFiltered.filter(v => !v.isShort).length;
            const shortsCount = dateFiltered.filter(v => v.isShort).length;

            function SortTh({ col, label }: { col: typeof perfSort; label: string }) {
              const active = perfSort === col;
              return (
                <th
                  className="text-right px-4 py-3 font-medium cursor-pointer select-none hover:text-[var(--text-2)] transition-colors whitespace-nowrap"
                  onClick={() => {
                    if (active) setPerfSortDir(d => d === "desc" ? "asc" : "desc");
                    else { setPerfSort(col); setPerfSortDir("desc"); }
                  }}
                >
                  <span style={active ? { color: "var(--accent)" } : undefined}>{label}</span>
                  <span className="ml-1 text-[10px]">{active ? (perfSortDir === "desc" ? "▼" : "▲") : "↕"}</span>
                </th>
              );
            }

            return (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Total Videos", value: perfData.totalVideos.toString() },
                    { label: "Avg Views", value: fmtNum(perfData.avgViews) },
                    { label: "Avg Engagement", value: `${perfData.avgEngagement}%` },
                    { label: "Channel", value: "Your Channel" },
                  ].map(s => (
                    <Panel key={s.label} className="p-4">
                      <p className="eyebrow">{s.label}</p>
                      <p className="num text-[32px] font-semibold tracking-[-0.02em] leading-tight text-[var(--text)] mt-1">{s.value}</p>
                    </Panel>
                  ))}
                </div>

                {/* Filters row */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Content type pills */}
                  <div className="flex items-center gap-1.5 bg-[var(--surface-1)] rounded-[var(--r-md)] border border-[var(--line)] p-1">
                    {([
                      { key: "all" as const, label: `All (${dateFiltered.length})` },
                      { key: "longform" as const, label: `📹 Long Form (${longformCount})` },
                      { key: "shorts" as const, label: `⚡ Shorts (${shortsCount})` },
                    ]).map(t => (
                      <button
                        key={t.key}
                        onClick={() => setPerfVideoType(t.key)}
                        className="text-xs px-3 py-1.5 rounded-[var(--r-sm)] font-medium transition-colors"
                        style={perfVideoType === t.key ? { color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, transparent)" } : { color: "var(--text-3)" }}
                      >{t.label}</button>
                    ))}
                  </div>

                  {/* Time range */}
                  <select
                    value={perfFilter}
                    onChange={e => setPerfFilter(e.target.value as "all" | "30" | "90")}
                    className="text-xs bg-[var(--surface-1)] border border-[var(--line)] text-[var(--text-2)] rounded-[var(--r-md)] px-3 py-2 cursor-pointer"
                  >
                    <option value="all">All time</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                  </select>

                  <p className="num text-xs text-[var(--text-3)] ml-auto">
                    Showing {sorted.length} video{sorted.length !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Table */}
                <Panel className="overflow-hidden !p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] text-[var(--text-3)] uppercase tracking-wider border-b border-[var(--line)]">
                          <th className="text-left px-4 py-3 font-medium">Video</th>
                          <SortTh col="views" label="Views" />
                          <SortTh col="likes" label="Likes" />
                          <SortTh col="comments" label="Comments" />
                          <SortTh col="publishedAt" label="Published" />
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map(v => (
                          <tr key={v.id} className="border-b border-[var(--line)] hover:bg-[var(--surface-2)] transition-colors group">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <a href={v.url} target="_blank" rel="noopener noreferrer" className="relative shrink-0">
                                  <img
                                    src={v.thumbnail}
                                    alt={v.title}
                                    className="w-28 h-[63px] object-cover rounded-[var(--r-sm)] bg-[var(--surface-3)] border border-[var(--line)] opacity-90 group-hover:opacity-100 transition-all"
                                  />
                                  {v.isShort && (
                                    <span className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 rounded bg-[#ff0000] text-white font-bold leading-none">SHORT</span>
                                  )}
                                </a>
                                <a
                                  href={v.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[var(--text-2)] hover:text-[var(--text)] line-clamp-2 leading-snug text-[13px]"
                                  title={v.title}
                                >
                                  {v.title}
                                </a>
                              </div>
                            </td>
                            <td className="num px-4 py-3 text-right text-[var(--text)] font-semibold">{fmtNum(v.views)}</td>
                            <td className="num px-4 py-3 text-right text-[var(--text-2)]">{fmtNum(v.likes)}</td>
                            <td className="num px-4 py-3 text-right text-[var(--text-2)]">{v.comments.toLocaleString()}</td>
                            <td className="num px-4 py-3 text-right text-[var(--text-3)] text-xs whitespace-nowrap">{fmtPubDate(v.publishedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </>
            );
          })() : (
            <EmptyState title="Failed to load performance data." />
          )}
        </div>
      )}
      </AccessibleTabPanel>
    </div>
  );
}
