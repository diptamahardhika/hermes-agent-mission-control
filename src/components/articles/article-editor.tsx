"use client";

import { useState } from "react";
import type { Article, Track } from "@/lib/articles-config";
import { TRACK_CONFIG } from "@/lib/articles-config";

// ─── Article Editor ───────────────────────────────────────────────────────────

export function ArticleEditor({
  article,
  onClose,
  onUpdate,
  onDelete,
}: {
  article: Article;
  onClose: () => void;
  onUpdate: (updates: Partial<Article>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(article.title);
  const [body, setBody] = useState(article.body);
  const [qtTweet, setQtTweet] = useState(article.qtTweet || "");
  const [qtUrl, setQtUrl] = useState(article.qtUrl || "");
  const [status, setStatus] = useState(article.status);
  const [track, setTrack] = useState<Track>(article.track);
  const [postedUrl, setPostedUrl] = useState(article.postedUrl || "");
  const [impressions, setImpressions] = useState(article.impressions ?? "");
  const [likes, setLikes] = useState(article.likes ?? "");
  const [bookmarks, setBookmarks] = useState(article.bookmarks ?? "");
  const [heroImageUrl, setHeroImageUrl] = useState(article.heroImageUrl || "");
  const todayStr = new Date().toISOString().split("T")[0];
  const [postedDate, setPostedDate] = useState(
    article.postedAt ? new Date(article.postedAt).toISOString().split("T")[0]
    : article.scheduledDate || todayStr
  );
  const [prevStatus, setPrevStatus] = useState(article.status);

  // Visual generation state
  interface VisualPlanItem {
    position: string;
    type: string;
    description: string;
    content: string;
    canGenerate: boolean;
    userAction: string | null;
    html?: string;
    generating?: boolean;
  }
  const [visualPlan, setVisualPlan] = useState<VisualPlanItem[]>([]);
  const [planningVisuals, setPlanningVisuals] = useState(false);
  const [generatedVisuals, setGeneratedVisuals] = useState<{ type: string; html: string }[]>([]);
  const [selectedVisualIndex, setSelectedVisualIndex] = useState<number | null>(null);
  const [editorTab, setEditorTab] = useState<"write" | "visuals">("write");

  // QT generation state for library editor
  const [generatingEditorQT, setGeneratingEditorQT] = useState(false);
  const [saveConfirm, setSaveConfirm] = useState(false);
  const [refreshingMetrics, setRefreshingMetrics] = useState(false);

  const handleRefreshMetrics = async () => {
    if (!postedUrl) return;
    setRefreshingMetrics(true);
    try {
      const res = await fetch("/api/articles/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: postedUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.impressions != null) setImpressions(data.impressions);
        if (data.likes != null) setLikes(data.likes);
        if (data.bookmarks != null) setBookmarks(data.bookmarks);
      }
    } finally {
      setRefreshingMetrics(false);
    }
  };

  // When status changes to "posted", auto-set date to today
  if (status === "posted" && prevStatus !== "posted") {
    setPrevStatus("posted");
    if (!postedDate) setPostedDate(todayStr);
  } else if (status !== prevStatus) {
    setPrevStatus(status);
  }

  const handleSave = () => {
    const updates: Partial<Article> & Record<string, unknown> = {
      title,
      body,
      qtTweet: qtTweet || null,
      qtUrl: qtUrl || null,
      status,
      track,
      postedUrl: postedUrl || null,
      heroImageUrl: heroImageUrl || null,
      impressions: impressions !== "" ? Number(impressions) : null,
      likes: likes !== "" ? Number(likes) : null,
      bookmarks: bookmarks !== "" ? Number(bookmarks) : null,
    };

    if (status === "posted") {
      updates.postedAt = postedDate ? new Date(postedDate).toISOString() : new Date().toISOString();
      updates.scheduledDate = postedDate || todayStr;
    }

    onUpdate(updates);
    setSaveConfirm(true);
    setTimeout(() => setSaveConfirm(false), 2000);
  };

  const handlePlanVisuals = async () => {
    setPlanningVisuals(true);
    setVisualPlan([]);
    try {
      const res = await fetch("/api/articles/generate-visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.id,
          title,
          articleBody: body,
          track: track,
          mode: "plan",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setVisualPlan(data.plan || []);
      }
    } finally {
      setPlanningVisuals(false);
    }
  };

  const handleGeneratePlanItem = async (index: number) => {
    const item = visualPlan[index];
    if (!item || !item.canGenerate) return;

    setVisualPlan((prev) => prev.map((p, i) => i === index ? { ...p, generating: true } : p));
    try {
      const res = await fetch("/api/articles/generate-visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.id,
          title,
          articleBody: body,
          track: track,
          visualType: item.type,
          content: item.content,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const html = data.visuals?.[0]?.html || "";
        setVisualPlan((prev) =>
          prev.map((p, i) => i === index ? { ...p, html, generating: false } : p)
        );
        if (html) {
          setGeneratedVisuals((prev) => [...prev, { type: item.type, html }]);
        }
      }
    } catch {
      setVisualPlan((prev) => prev.map((p, i) => i === index ? { ...p, generating: false } : p));
    }
  };

  const handleGenerateAllFromPlan = async () => {
    const generatable = visualPlan
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => item.canGenerate && !item.html);
    for (const { i } of generatable) {
      await handleGeneratePlanItem(i);
    }
  };

  const handleUseAsHero = (html: string) => {
    onUpdate({ heroImageHtml: html });
  };

  const handleGenerateEditorQT = async () => {
    setGeneratingEditorQT(true);
    try {
      const res = await fetch("/api/articles/generate-qt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.id,
          title,
          body,
          track: article.track,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setQtTweet(data.qtTweet);
      }
    } finally {
      setGeneratingEditorQT(false);
    }
  };

  const trackConfig = TRACK_CONFIG[track];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
            ← Back to Library
          </button>
          <select
            value={track}
            onChange={(e) => setTrack(e.target.value as Track)}
            className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none ${trackConfig.bgColor} ${trackConfig.color}`}
          >
            <option value="mega-viral">🔴 Mega Viral</option>
            <option value="local-viral">🟡 Local Viral</option>
            <option value="icp-viral">🟢 ICP Viral</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          {/* Editor/Visuals tab toggle */}
          <div className="flex gap-1 bg-[var(--surface-2)] rounded-[var(--r-md)] p-0.5">
            <button
              onClick={() => setEditorTab("write")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                editorTab === "write" ? "bg-[var(--surface-3)] text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
              }`}
            >
              Write
            </button>
            <button
              onClick={() => setEditorTab("visuals")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                editorTab === "visuals" ? "bg-[var(--surface-3)] text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
              }`}
            >
              Visuals
            </button>
          </div>
          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-[var(--down)] hover:bg-[color-mix(in_srgb,var(--down)_10%,transparent)] rounded-[var(--r-md)] text-sm"
          >
            Delete
          </button>
        </div>
      </div>

      {editorTab === "write" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-md)] p-4 text-lg font-bold text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)]"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full h-[400px] bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-md)] p-4 text-sm leading-relaxed text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)] resize-none"
            />
            <div className="text-xs text-[var(--text-3)]">
              <span className="num">{body.split(/\s+/).filter(Boolean).length}</span> words
            </div>

            {/* QT Tweet */}
            <div className="border-t border-[var(--line)] pt-4">
              <h4 className="text-sm font-semibold mb-2 text-[var(--text)]">QT Tweet</h4>
              <textarea
                value={qtTweet}
                onChange={(e) => setQtTweet(e.target.value)}
                placeholder="Write the hook tweet..."
                className="w-full h-24 bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-md)] p-4 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)] resize-none"
              />
              <button
                onClick={handleGenerateEditorQT}
                disabled={generatingEditorQT}
                className="mt-2 text-xs text-[var(--text-3)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
              >
                {generatingEditorQT ? "Generating..." : qtTweet ? "🔄 Regenerate QT" : "Generate QT Tweet"}
              </button>

              {/* QT URL */}
              <div className="mt-3 space-y-1">
                <label className="text-[10px] text-[var(--text-3)] uppercase">QT Tweet Link</label>
                <input
                  type="url"
                  value={qtUrl}
                  onChange={(e) => setQtUrl(e.target.value)}
                  placeholder="https://x.com/yourhandle/status/... (the QT post)"
                  className="w-full bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-md)] p-2 text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)]"
                />
                {qtUrl && (
                  <a href={qtUrl} target="_blank" rel="noreferrer" className="text-xs text-[var(--accent)] hover:opacity-80">
                    View QT on X ↗
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                className={`px-4 py-2 text-sm ${
                  saveConfirm
                    ? "rounded-full bg-[var(--up)] text-[#0a0b0d] font-semibold"
                    : "btn-primary"
                }`}
              >
                {saveConfirm ? "Saved ✓" : "Save Changes"}
              </button>
              {saveConfirm && (
                <span className="text-xs text-[var(--up)] animate-pulse">Changes saved</span>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="panel p-4 space-y-3">
              <h4 className="eyebrow">Status</h4>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Article["status"])}
                className="w-full bg-[var(--surface-2)] border border-[var(--line)] rounded-[var(--r-md)] p-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--line-strong)]"
              >
                <option value="idea">Idea</option>
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="posted">Posted</option>
              </select>
            </div>

            {/* Hero Image */}
            <div className="panel p-4 space-y-3">
              <h4 className="eyebrow">Hero Image</h4>
              {heroImageUrl ? (
                <div className="space-y-2">
                  <div className="rounded-[var(--r-md)] overflow-hidden border border-[var(--line)]">
                    <img
                      src={heroImageUrl}
                      alt="Hero preview"
                      className="w-full h-auto object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                  <button
                    onClick={() => setHeroImageUrl("")}
                    className="text-xs text-[var(--down)] hover:opacity-80"
                  >
                    Remove image
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 p-4 border border-dashed border-[var(--line)] rounded-[var(--r-md)] cursor-pointer hover:border-[var(--line-strong)] transition">
                  <span className="text-[var(--text-3)] text-xs">Click to upload image</span>
                  <span className="text-[var(--text-4)] text-[10px]">PNG, JPG, WebP</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      // Compress image to fit within API body limits
                      const img = new Image();
                      const reader = new FileReader();
                      reader.onload = () => {
                        img.onload = () => {
                          const canvas = document.createElement("canvas");
                          const maxW = 1200;
                          const scale = Math.min(1, maxW / img.width);
                          canvas.width = img.width * scale;
                          canvas.height = img.height * scale;
                          const ctx = canvas.getContext("2d")!;
                          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                          const compressed = canvas.toDataURL("image/jpeg", 0.8);
                          setHeroImageUrl(compressed);
                        };
                        img.src = reader.result as string;
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              )}
            </div>

            {(status === "posted" || status === "ready") && (
              <div className="panel p-4 space-y-3">
                <h4 className="eyebrow">Article Link</h4>
                <input
                  type="url"
                  value={postedUrl}
                  onChange={(e) => setPostedUrl(e.target.value)}
                  placeholder="https://x.com/yourhandle/status/..."
                  className="w-full bg-[var(--surface-2)] border border-[var(--line)] rounded-[var(--r-md)] p-2 text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)]"
                />
                {postedUrl && (
                  <a
                    href={postedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--accent)] hover:opacity-80 block"
                  >
                    View on X ↗
                  </a>
                )}
              </div>
            )}

            {status === "posted" && (
              <div className="panel p-4 space-y-3">
                <h4 className="eyebrow">Posted Date</h4>
                <input
                  type="date"
                  value={postedDate}
                  onChange={(e) => setPostedDate(e.target.value)}
                  className="w-full bg-[var(--surface-2)] border border-[var(--line)] rounded-[var(--r-md)] p-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--line-strong)] [color-scheme:dark]"
                />
              </div>
            )}

            {status === "posted" && (
              <div className="panel p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="eyebrow">Metrics</h4>
                  {postedUrl && (
                    <button
                      onClick={handleRefreshMetrics}
                      disabled={refreshingMetrics}
                      className="text-[10px] text-[var(--text-3)] hover:text-[var(--accent)] disabled:opacity-50 transition"
                    >
                      {refreshingMetrics ? "Refreshing..." : "🔄 Refresh"}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[var(--text-3)] uppercase">Impressions</label>
                    <input
                      type="number"
                      value={impressions}
                      onChange={(e) => setImpressions(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-[var(--surface-2)] border border-[var(--line)] rounded-[var(--r-md)] p-2 text-xs num text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[var(--text-3)] uppercase">Likes</label>
                    <input
                      type="number"
                      value={likes}
                      onChange={(e) => setLikes(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-[var(--surface-2)] border border-[var(--line)] rounded-[var(--r-md)] p-2 text-xs num text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[var(--text-3)] uppercase">Bookmarks</label>
                    <input
                      type="number"
                      value={bookmarks}
                      onChange={(e) => setBookmarks(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-[var(--surface-2)] border border-[var(--line)] rounded-[var(--r-md)] p-2 text-xs num text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)]"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="text-xs text-[var(--text-4)]">
              Created: {new Date(article.createdAt).toLocaleString()}
              <br />
              Updated: {new Date(article.updatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {editorTab === "visuals" && (
        <div className="space-y-6">
          {/* Plan Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePlanVisuals}
              disabled={planningVisuals}
              className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {planningVisuals ? (
                <><span className="animate-spin">⏳</span> Analyzing article...</>
              ) : (
                <>Analyze Article &amp; Plan Visuals</>
              )}
            </button>
            {visualPlan.length > 0 && (
              <button
                onClick={handleGenerateAllFromPlan}
                disabled={planningVisuals}
                className="btn-ghost px-4 py-2 text-sm"
              >
                Generate All (<span className="num">{visualPlan.filter((p) => p.canGenerate && !p.html).length}</span>)
              </button>
            )}
          </div>

          {/* Visual Plan */}
          {visualPlan.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[var(--text-2)]">
                Visual Plan (<span className="num">{visualPlan.length}</span> visuals recommended)
              </h3>
              <div className="space-y-3">
                {visualPlan.map((item, i) => (
                  <div key={i} className={`bg-[var(--surface-1)] border rounded-[var(--r-lg)] overflow-hidden ${
                    item.canGenerate ? "border-[var(--line)]" : "border-[color-mix(in_srgb,var(--warn)_25%,transparent)]"
                  }`}>
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-2)]">
                              {item.type}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded ${
                              item.canGenerate
                                ? "bg-[color-mix(in_srgb,var(--up)_12%,transparent)] text-[var(--up)]"
                                : "bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] text-[var(--warn)]"
                            }`}>
                              {item.canGenerate ? "Can generate" : "User action needed"}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-2)] font-medium">{item.description}</p>
                          <p className="text-[10px] text-[var(--text-3)] mt-1">{item.position}</p>
                          {item.content && (
                            <p className="text-[10px] text-[var(--text-4)] mt-1 line-clamp-2">Data: {item.content}</p>
                          )}
                          {item.userAction && (
                            <p className="text-xs text-[var(--warn)] mt-2">→ {item.userAction}</p>
                          )}
                        </div>
                        {item.canGenerate && (
                          <button
                            onClick={() => handleGeneratePlanItem(i)}
                            disabled={!!item.generating || !!item.html}
                            className={`px-3 py-1.5 rounded-[var(--r-md)] text-xs transition flex-shrink-0 ${
                              item.html
                                ? "bg-[color-mix(in_srgb,var(--up)_18%,transparent)] text-[var(--up)]"
                                : item.generating
                                ? "bg-[var(--surface-3)] text-[var(--text-3)]"
                                : "bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_28%,transparent)]"
                            }`}
                          >
                            {item.html ? "Generated ✓" : item.generating ? "Generating..." : "Generate"}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Preview generated visual */}
                    {item.html && (
                      <div className="border-t border-[var(--line)]">
                        <iframe
                          srcDoc={item.html}
                          className="w-full border-0"
                          style={{ height: "300px" }}
                          sandbox="allow-same-origin"
                          title={`${item.type} visual`}
                        />
                        <div className="px-4 py-2 border-t border-[var(--line)] flex gap-2">
                          <button
                            onClick={() => { handleUseAsHero(item.html!); }}
                            className="px-3 py-1 bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] rounded-[var(--r-md)] text-xs transition"
                          >
                            Use as Hero
                          </button>
                          <button
                            onClick={() => {
                              const blob = new Blob([item.html!], { type: "text/html" });
                              const u = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = u; a.download = `${article.id}-${item.type}.html`;
                              a.click(); URL.revokeObjectURL(u);
                            }}
                            className="px-3 py-1 bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] rounded-[var(--r-md)] text-xs transition"
                          >
                            Download
                          </button>
                          <button
                            onClick={() => { navigator.clipboard.writeText(item.html!); }}
                            className="px-3 py-1 bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] rounded-[var(--r-md)] text-xs transition"
                          >
                            Copy HTML
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Existing Hero */}
          {article.heroImageHtml && visualPlan.length === 0 && !planningVisuals && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[var(--text-2)]">Current Hero Visual</h3>
              <div className="panel overflow-hidden">
                <iframe
                  srcDoc={article.heroImageHtml}
                  className="w-full border-0"
                  style={{ height: "350px" }}
                  sandbox="allow-same-origin"
                  title="Current hero visual"
                />
              </div>
            </div>
          )}

          {/* Empty state */}
          {visualPlan.length === 0 && !article.heroImageHtml && !planningVisuals && (
            <div className="bg-[var(--surface-1)] border border-dashed border-[var(--line)] rounded-[var(--r-lg)] p-12 text-center">
              <p className="text-[var(--text-3)] text-sm">No visuals yet</p>
              <p className="text-[var(--text-4)] text-xs mt-1">
                Click &quot;Analyze Article &amp; Plan Visuals&quot; to get started
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
