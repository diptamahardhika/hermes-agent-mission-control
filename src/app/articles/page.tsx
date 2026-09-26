"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { rise, Skeleton } from "@/components/ui/kit";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Article {
  id: string;
  title: string;
  body: string;
  track: "mega-viral" | "local-viral" | "icp-viral";
  status: "idea" | "draft" | "ready" | "posted";
  qtTweet: string | null;
  qtUrl: string | null;
  heroImageUrl: string | null;
  heroImageHtml: string | null;
  inspirationUrls: string | null;
  themes: string | null;
  scheduledDate: string | null;
  postedAt: string | null;
  postedUrl: string | null;
  impressions: number | null;
  likes: number | null;
  bookmarks: number | null;
  createdAt: string;
  updatedAt: string;
}

interface SavedTitle {
  id: string;
  title: string;
  track: string;
  themes: string | null;
  createdAt: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  searchUsed?: boolean;
}

type Track = "mega-viral" | "local-viral" | "icp-viral";
type Tab = "compose" | "library" | "calendar";

const TRACK_CONFIG: Record<Track, { emoji: string; label: string; description: string; color: string; bgColor: string; borderColor: string }> = {
  "mega-viral": {
    emoji: "🔴",
    label: "Mega Viral",
    description: "reCAPTCHA, Alexa, 23andMe energy. Designed to reach millions.",
    color: "text-[var(--text)]",
    bgColor: "bg-[var(--surface-2)]",
    borderColor: "border-[var(--line)]",
  },
  "local-viral": {
    emoji: "🟡",
    label: "Local Viral",
    description: "Claude features, AI tools, builder niche. Viral in our community.",
    color: "text-[var(--text)]",
    bgColor: "bg-[var(--surface-2)]",
    borderColor: "border-[var(--line)]",
  },
  "icp-viral": {
    emoji: "🟢",
    label: "ICP Viral",
    description: "Trojan horse content. Goes viral AND books calls from ideal clients.",
    color: "text-[var(--text)]",
    bgColor: "bg-[var(--surface-2)]",
    borderColor: "border-[var(--line)]",
  },
};

const THEMES = ["AI", "Claude", "OpenClaw", "Marketing", "Crypto", "Productivity", "Builder Tools", "Agency", "Founders"];

const STATUS_COLUMNS = ["idea", "draft", "ready", "posted"] as const;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ArticlesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-4 md:p-8"><div className="text-[var(--text-3)] text-sm">Loading...</div></div>}>
      <ArticlesPageContent />
    </Suspense>
  );
}

function ArticlesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = (searchParams.get("tab") as Tab) || "compose";

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  // Compose state
  const [composeStep, setComposeStep] = useState(1);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [inspirationUrls, setInspirationUrls] = useState("");
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [generatingTitles, setGeneratingTitles] = useState(false);
  const [generatingArticle, setGeneratingArticle] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<Partial<Article> | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);

  // Saved titles state
  const [savedTitles, setSavedTitles] = useState<SavedTitle[]>([]);

  // Chat revision state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);

  // QT generation state
  const [generatingQT, setGeneratingQT] = useState(false);

  // Load articles
  const loadArticles = useCallback(async () => {
    try {
      const res = await fetch("/api/articles", { cache: "no-store" });
      if (res.ok) {
        setArticles(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load saved titles
  const loadSavedTitles = useCallback(async () => {
    try {
      const res = await fetch("/api/articles/saved-titles", { cache: "no-store" });
      if (res.ok) {
        setSavedTitles(await res.json());
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadArticles();
    loadSavedTitles();
  }, [loadArticles, loadSavedTitles]);

  const setTab = (newTab: Tab) => {
    router.push(`/articles?tab=${newTab}`);
  };

  // ─── Compose Handlers ───────────────────────────────────────────────────────

  const handleSelectTrack = (track: Track) => {
    setSelectedTrack(track);
    setComposeStep(2);
  };

  // Build inspiration data: full bodies from library articles, URLs for external
  const getInspirationData = () => {
    const urls = inspirationUrls.split("\n").filter(Boolean);
    const libraryInspirations: { title: string; body: string; impressions: number | null; likes: number | null; bookmarks: number | null }[] = [];
    const externalUrls: string[] = [];

    for (const url of urls) {
      const match = articles.find((a) => a.postedUrl === url);
      if (match && match.body) {
        libraryInspirations.push({
          title: match.title,
          body: match.body,
          impressions: match.impressions,
          likes: match.likes,
          bookmarks: match.bookmarks,
        });
      } else {
        externalUrls.push(url);
      }
    }
    return { libraryInspirations, externalUrls };
  };

  const handleGenerateTitles = async () => {
    if (!selectedTrack) return;
    setGeneratingTitles(true);
    const { libraryInspirations, externalUrls } = getInspirationData();
    try {
      const res = await fetch("/api/articles/generate-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track: selectedTrack,
          themes: JSON.stringify(selectedThemes),
          inspirationUrls: JSON.stringify(externalUrls),
          libraryInspirations,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedTitles(data.titles);
        setComposeStep(3);
      }
    } finally {
      setGeneratingTitles(false);
    }
  };

  const handleSelectTitle = async (title: string) => {
    setSelectedTitle(title);
    setGeneratingArticle(true);
    setComposeStep(4);
    const { libraryInspirations, externalUrls } = getInspirationData();
    try {
      const res = await fetch("/api/articles/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          track: selectedTrack,
          themes: JSON.stringify(selectedThemes),
          inspirationUrls: JSON.stringify(externalUrls),
          libraryInspirations,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentArticle({
          title: data.title,
          body: data.body,
          track: selectedTrack!,
          themes: JSON.stringify(selectedThemes),
          inspirationUrls: JSON.stringify(inspirationUrls.split("\n").filter(Boolean)),
        });
      }
    } finally {
      setGeneratingArticle(false);
    }
  };

  const handleSaveArticle = async (status: "draft" | "ready") => {
    if (!currentArticle) return;
    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...currentArticle,
          status,
        }),
      });
      if (res.ok) {
        await loadArticles();
        resetCompose();
        setTab("library");
      }
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const handleGenerateQT = async () => {
    if (!currentArticle?.title || !currentArticle?.body) return;
    setGeneratingQT(true);
    try {
      const res = await fetch("/api/articles/generate-qt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: currentArticle.title,
          body: currentArticle.body,
          track: selectedTrack || currentArticle.track,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentArticle(prev => ({
          ...prev,
          qtTweet: data.qtTweet,
        }));
      }
    } finally {
      setGeneratingQT(false);
    }
  };

  const resetCompose = () => {
    setComposeStep(1);
    setSelectedTrack(null);
    setInspirationUrls("");
    setSelectedThemes([]);
    setGeneratedTitles([]);
    setSelectedTitle(null);
    setCurrentArticle(null);
    setChatMessages([]);
    setChatInput("");
  };

  // ─── Chat Revision Handlers ─────────────────────────────────────────────────

  const handleChatSend = async () => {
    if (!chatInput.trim() || !currentArticle?.body || chatLoading) return;

    const userMessage: ChatMessage = { role: "user", content: chatInput.trim() };
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/articles/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: currentArticle.title,
          articleBody: currentArticle.body,
          track: selectedTrack || currentArticle.track,
          instruction: userMessage.content,
          searchEnabled,
          messages: updatedMessages.slice(-10), // last 10 messages for context
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.message,
          searchUsed: data.searchUsed,
        };
        setChatMessages(prev => [...prev, assistantMessage]);

        if (data.type === "revision" && data.revisedBody) {
          setCurrentArticle(prev => ({ ...prev, body: data.revisedBody }));
        }
      } else {
        setChatMessages(prev => [
          ...prev,
          { role: "assistant", content: "Something went wrong. Try again." },
        ]);
      }
    } catch {
      setChatMessages(prev => [
        ...prev,
        { role: "assistant", content: "Network error. Try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // ─── Saved Title Handlers ───────────────────────────────────────────────────

  const handleSaveTitle = async (title: string) => {
    try {
      const res = await fetch("/api/articles/saved-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          track: selectedTrack || "local-viral",
          themes: JSON.stringify(selectedThemes),
        }),
      });
      if (res.ok) {
        await loadSavedTitles();
      }
    } catch {}
  };

  const handleAddArticle = async (articleData: Partial<Article>) => {
    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(articleData),
      });
      if (res.ok) {
        await loadArticles();
      }
    } catch (err) {
      console.error("Add article error:", err);
    }
  };

  const handleRemoveSavedTitle = async (id: string) => {
    try {
      const res = await fetch("/api/articles/saved-titles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await loadSavedTitles();
      }
    } catch {}
  };

  // ─── Library Handlers ───────────────────────────────────────────────────────

  const handleUpdateArticle = async (id: string, updates: Partial<Article>) => {
    try {
      const res = await fetch("/api/articles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (res.ok) {
        await loadArticles();
      }
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    try {
      const res = await fetch("/api/articles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await loadArticles();
        setEditingArticle(null);
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // ─── Calendar Helpers ───────────────────────────────────────────────────────

  const [calendarWeekOffset, setCalendarWeekOffset] = useState(0);

  const getWeekDays = () => {
    const now = new Date();
    now.setDate(now.getDate() + calendarWeekOffset * 7);
    const monday = new Date(now);
    const day = now.getDay();
    // getDay(): 0=Sun, 1=Mon... Fix Sunday (0) to go back to previous Monday
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(now.getDate() + diff);

    const days: { date: string; label: string; dayName: string; isToday: boolean }[] = [];
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      days.push({
        date: dateStr,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        dayName: dayNames[i],
        isToday: dateStr === todayStr,
      });
    }
    return days;
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="relative z-10 min-h-screen w-full mx-auto p-4 md:p-8 text-[var(--text)]">
      {/* Header */}
      <div className="hq-rise mb-8" style={rise(0)}>
        <div className="eyebrow mb-2.5">Article Studio</div>
        <h1 className="text-[32px] font-semibold tracking-[-0.025em] leading-none text-[var(--text)]">Compose &amp; publish</h1>

        {/* Tab Nav */}
        <div className="flex gap-1 mt-6">
          {(["compose", "library", "calendar"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-2 rounded-[var(--r-md)] text-[13px] font-medium transition-colors ${
                tab === t
                  ? "bg-[var(--surface-2)] text-[var(--text)]"
                  : "text-[var(--text-3)] hover:text-[var(--text)]"
              }`}
            >
              {t === "compose" ? "Compose" : t === "library" ? "Library" : "Calendar"}
            </button>
          ))}
        </div>
        <div className="rule mt-2" />
      </div>

      {/* Tab Content */}
      {tab === "compose" && (
        <ComposeTab
          step={composeStep}
          selectedTrack={selectedTrack}
          inspirationUrls={inspirationUrls}
          selectedThemes={selectedThemes}
          generatedTitles={generatedTitles}
          generatingTitles={generatingTitles}
          generatingArticle={generatingArticle}
          generatingQT={generatingQT}
          currentArticle={currentArticle}
          savedTitles={savedTitles}
          articles={articles}
          chatMessages={chatMessages}
          chatInput={chatInput}
          chatLoading={chatLoading}
          searchEnabled={searchEnabled}
          onSelectTrack={handleSelectTrack}
          onSetInspirationUrls={setInspirationUrls}
          onToggleTheme={(theme) => {
            setSelectedThemes(prev =>
              prev.includes(theme) ? prev.filter(t => t !== theme) : [...prev, theme]
            );
          }}
          onGenerateTitles={handleGenerateTitles}
          onSelectTitle={handleSelectTitle}
          onRegenerateTitles={handleGenerateTitles}
          onUpdateArticle={(updates) => setCurrentArticle(prev => ({ ...prev, ...updates }))}
          onSaveArticle={handleSaveArticle}
          onGenerateQT={handleGenerateQT}
          onSaveTitle={handleSaveTitle}
          onRemoveSavedTitle={handleRemoveSavedTitle}
          onChatSend={handleChatSend}
          onChatInputChange={setChatInput}
          onToggleSearch={() => setSearchEnabled(prev => !prev)}
          onBack={() => setComposeStep(prev => Math.max(1, prev - 1))}
          onReset={resetCompose}
        />
      )}

      {tab === "library" && (
        <LibraryTab
          articles={articles}
          loading={loading}
          editingArticle={editingArticle}
          onSetEditingArticle={setEditingArticle}
          onUpdateArticle={handleUpdateArticle}
          onDeleteArticle={handleDeleteArticle}
          onAddArticle={handleAddArticle}
        />
      )}

      {tab === "calendar" && (
        <CalendarTab
          articles={articles}
          weekDays={getWeekDays()}
          weekOffset={calendarWeekOffset}
          onPrevWeek={() => setCalendarWeekOffset(prev => prev - 1)}
          onNextWeek={() => setCalendarWeekOffset(prev => prev + 1)}
          onToday={() => setCalendarWeekOffset(0)}
          onUpdateArticle={handleUpdateArticle}
          onOpenArticle={(article) => {
            setEditingArticle(article);
            setTab("library");
          }}
        />
      )}
      </div>
    </>
  );
}

// ─── Compose Tab ──────────────────────────────────────────────────────────────

interface ComposeTabProps {
  step: number;
  selectedTrack: Track | null;
  inspirationUrls: string;
  selectedThemes: string[];
  generatedTitles: string[];
  generatingTitles: boolean;
  generatingArticle: boolean;
  generatingQT: boolean;
  currentArticle: Partial<Article> | null;
  savedTitles: SavedTitle[];
  articles: Article[];
  chatMessages: ChatMessage[];
  chatInput: string;
  chatLoading: boolean;
  searchEnabled: boolean;
  onSelectTrack: (track: Track) => void;
  onSetInspirationUrls: (v: string) => void;
  onToggleTheme: (theme: string) => void;
  onGenerateTitles: () => void;
  onSelectTitle: (title: string) => void;
  onRegenerateTitles: () => void;
  onUpdateArticle: (updates: Partial<Article>) => void;
  onSaveArticle: (status: "draft" | "ready") => void;
  onGenerateQT: () => void;
  onSaveTitle: (title: string) => void;
  onRemoveSavedTitle: (id: string) => void;
  onChatSend: () => void;
  onChatInputChange: (v: string) => void;
  onToggleSearch: () => void;
  onBack: () => void;
  onReset: () => void;
}

function ComposeTab({
  step,
  selectedTrack,
  inspirationUrls,
  selectedThemes,
  generatedTitles,
  generatingTitles,
  generatingArticle,
  generatingQT,
  currentArticle,
  savedTitles,
  articles,
  chatMessages,
  chatInput,
  chatLoading,
  searchEnabled,
  onSelectTrack,
  onSetInspirationUrls,
  onToggleTheme,
  onGenerateTitles,
  onSelectTitle,
  onRegenerateTitles,
  onUpdateArticle,
  onSaveArticle,
  onGenerateQT,
  onSaveTitle,
  onRemoveSavedTitle,
  onChatSend,
  onChatInputChange,
  onToggleSearch,
  onBack,
  onReset,
}: ComposeTabProps) {
  // Step indicator
  const steps = [
    { num: 1, label: "Track" },
    { num: 2, label: "Style" },
    { num: 3, label: "Title" },
    { num: 4, label: "Write" },
    { num: 5, label: "Visuals" },
  ];

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-10">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] num font-medium border transition ${
                step === s.num
                  ? "border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                  : step > s.num
                  ? "border-[var(--line)] text-[var(--text-2)] bg-[var(--surface-1)]"
                  : "border-[var(--line)] text-[var(--text-4)] bg-transparent"
              }`}
            >
              {step > s.num ? "✓" : s.num}
            </div>
            <span
              className={`ml-2 text-[13px] font-medium ${
                step === s.num ? "text-[var(--text)]" : "text-[var(--text-4)]"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className="w-8 h-px bg-[var(--line)] mx-3" />
            )}
          </div>
        ))}
        {step > 1 && (
          <button
            onClick={onReset}
            className="ml-auto text-[12px] text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
          >
            Start Over
          </button>
        )}
      </div>

      {/* Step 1: Track Selection */}
      {step === 1 && (
        <div className="space-y-5">
          <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[var(--text)]">Choose your track</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.entries(TRACK_CONFIG) as [Track, typeof TRACK_CONFIG[Track]][]).map(
              ([track, config]) => (
                <button
                  key={track}
                  onClick={() => onSelectTrack(track)}
                  className="panel panel-interactive p-6 text-left"
                >
                  <div className="text-2xl mb-3">{config.emoji}</div>
                  <h3 className="text-[15px] font-semibold mb-2 text-[var(--text)]">
                    {config.label}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-[var(--text-2)]">{config.description}</p>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Step 2: Style & Themes */}
      {step === 2 && selectedTrack && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-[13px] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
              ← Back
            </button>
            <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[var(--text)]">Style &amp; themes</h2>
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-2)]">
              {TRACK_CONFIG[selectedTrack].emoji} {TRACK_CONFIG[selectedTrack].label}
            </span>
          </div>

          {/* Voice Library — pick from your posted articles (filtered by track) */}
          {(() => {
            const postedArticles = articles
              .filter((a) => a.status === "posted" && a.postedUrl && a.track === selectedTrack)
              .sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
            if (postedArticles.length === 0) return null;
            return (
              <div className="space-y-2.5">
                <label className="text-[13px] text-[var(--text-2)]">
                  Pick from your {TRACK_CONFIG[selectedTrack].label} articles as style inspiration
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {postedArticles.map((a) => {
                    const isSelected = inspirationUrls.includes(a.postedUrl!);
                    return (
                      <button
                        key={a.id}
                        onClick={() => {
                          if (isSelected) {
                            onSetInspirationUrls(
                              inspirationUrls
                                .split("\n")
                                .filter((u) => u.trim() !== a.postedUrl)
                                .join("\n")
                            );
                          } else {
                            onSetInspirationUrls(
                              [inspirationUrls, a.postedUrl].filter(Boolean).join("\n")
                            );
                          }
                        }}
                        className={`rounded-[var(--r-md)] text-left transition overflow-hidden border ${
                          isSelected
                            ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                            : "border-[var(--line)] bg-[var(--surface-1)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)]"
                        }`}
                      >
                        {a.heroImageUrl && (
                          <div
                            className="w-full h-20 bg-cover bg-center"
                            style={{ backgroundImage: `url(${a.heroImageUrl})` }}
                          />
                        )}
                        <div className="p-3">
                          <span className="line-clamp-2 text-[12px] font-medium text-[var(--text)]">{a.title}</span>
                          {a.impressions != null && (
                            <span className="text-[10px] num text-[var(--text-3)] block mt-1">
                              👀 {a.impressions.toLocaleString()}
                              {a.likes != null && ` · ❤️ ${a.likes.toLocaleString()}`}
                              {a.bookmarks != null && ` · 🔖 ${a.bookmarks.toLocaleString()}`}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Inspiration URLs */}
          <div className="space-y-2.5">
            <label className="text-[13px] text-[var(--text-2)]">
              Or paste external article URLs (one per line)
            </label>
            <textarea
              value={inspirationUrls}
              onChange={(e) => onSetInspirationUrls(e.target.value)}
              placeholder="https://x.com/yourhandle/status/...&#10;https://example.com/great-article"
              className="w-full h-24 bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-md)] p-4 text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] focus:border-[var(--line-strong)] resize-none"
            />
          </div>

          {/* Themes */}
          <div className="space-y-2.5">
            <label className="text-[13px] text-[var(--text-2)]">Select themes</label>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((theme) => (
                <button
                  key={theme}
                  onClick={() => onToggleTheme(theme)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition ${
                    selectedThemes.includes(theme)
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                      : "border-[var(--line)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--line-strong)]"
                  }`}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={onGenerateTitles}
            disabled={generatingTitles}
            className={`btn-primary px-5 py-2.5 text-[13px] inline-flex items-center gap-2 ${generatingTitles ? "opacity-40 pointer-events-none" : ""}`}
          >
            {generatingTitles ? (
              <>
                <span className="animate-spin">⏳</span> Generating...
              </>
            ) : (
              <>Generate Titles →</>
            )}
          </button>
        </div>
      )}

      {/* Step 3: Title Selection */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-[13px] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
              ← Back
            </button>
            <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[var(--text)]">Choose a title</h2>
          </div>

          {/* Saved Titles */}
          {savedTitles.length > 0 && (
            <div className="space-y-3">
              <h3 className="eyebrow">Saved Titles</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {savedTitles.map((saved) => (
                  <div
                    key={saved.id}
                    className="panel panel-interactive p-4 text-left group relative"
                  >
                    <button
                      onClick={() => onSelectTitle(saved.title)}
                      className="w-full text-left"
                    >
                      <p className="text-[13px] text-[var(--text)] pr-8 leading-snug">{saved.title}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] num text-[var(--text-3)]">
                          {new Date(saved.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-[11px] text-[var(--accent)] opacity-0 group-hover:opacity-100 transition">
                          Use this →
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSavedTitle(saved.id);
                      }}
                      className="absolute top-3 right-3 text-[var(--text-4)] hover:text-[var(--down)] transition text-sm"
                      title="Remove saved title"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Titles */}
          {generatedTitles.length > 0 && (
            <div className="space-y-3">
              {savedTitles.length > 0 && (
                <h3 className="eyebrow">Generated Titles</h3>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {generatedTitles.map((title, i) => {
                  const isSaved = savedTitles.some((s) => s.title === title);
                  return (
                    <div
                      key={i}
                      className="panel panel-interactive p-4 text-left group relative"
                    >
                      <button
                        onClick={() => onSelectTitle(title)}
                        className="w-full text-left"
                      >
                        <p className="text-[13px] text-[var(--text)] pr-8 leading-snug">{title}</p>
                        <span className="text-[11px] text-[var(--accent)] opacity-0 group-hover:opacity-100 transition mt-2 block">
                          Use this title →
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isSaved) onSaveTitle(title);
                        }}
                        className={`absolute top-3 right-3 transition text-lg ${
                          isSaved
                            ? "text-[var(--warn)] cursor-default"
                            : "text-[var(--text-4)] hover:text-[var(--warn)]"
                        }`}
                        title={isSaved ? "Already saved" : "Save for later"}
                        disabled={isSaved}
                      >
                        {isSaved ? "★" : "☆"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={onRegenerateTitles}
            disabled={generatingTitles}
            className="text-[13px] text-[var(--text-3)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
          >
            {generatingTitles ? "Regenerating..." : "🔄 Regenerate titles"}
          </button>
        </div>
      )}

      {/* Step 4: Writing */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-[13px] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
              ← Back
            </button>
            <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[var(--text)]">Write article</h2>
          </div>

          {generatingArticle ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="text-4xl mb-4 animate-pulse">✍️</div>
              <p className="text-[var(--text-2)] text-sm">Researching and writing...</p>
              <p className="text-[12px] text-[var(--text-3)] mt-2">This may take a moment</p>
            </div>
          ) : currentArticle ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Editor */}
              <div className="lg:col-span-2 space-y-4">
                <input
                  type="text"
                  value={currentArticle.title || ""}
                  onChange={(e) => onUpdateArticle({ title: e.target.value })}
                  className="w-full bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-md)] p-4 text-[18px] font-semibold text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)]"
                />
                <textarea
                  value={currentArticle.body || ""}
                  onChange={(e) => onUpdateArticle({ body: e.target.value })}
                  className="w-full h-[500px] bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-md)] p-4 text-[14px] leading-relaxed text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)] resize-none"
                />
                <div className="text-[12px] num text-[var(--text-3)]">
                  {(currentArticle.body || "").split(/\s+/).filter(Boolean).length} words
                </div>

                {/* Actions */}
                <div className="flex gap-2.5">
                  <button
                    onClick={() => onSaveArticle("draft")}
                    className="btn-ghost px-4 py-2 text-[13px]"
                  >
                    Save Draft
                  </button>
                  <button
                    onClick={() => onSaveArticle("ready")}
                    className="btn-primary px-4 py-2 text-[13px]"
                  >
                    Mark Ready
                  </button>
                </div>

                {/* QT Tweet Section */}
                <div className="rule mt-6" />
                <div className="pt-6">
                  <h3 className="eyebrow mb-3">QT Tweet Hook</h3>
                  {currentArticle.qtTweet ? (
                    <div className="space-y-2">
                      <textarea
                        value={currentArticle.qtTweet}
                        onChange={(e) => onUpdateArticle({ qtTweet: e.target.value })}
                        className="w-full h-32 bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-md)] p-4 text-[14px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)] resize-none"
                      />
                      <button
                        onClick={onGenerateQT}
                        disabled={generatingQT}
                        className="text-[12px] text-[var(--text-3)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
                      >
                        {generatingQT ? "Generating..." : "🔄 Regenerate"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={onGenerateQT}
                      disabled={generatingQT}
                      className="btn-ghost px-4 py-2 text-[13px] disabled:opacity-50"
                    >
                      {generatingQT ? "Generating QT..." : "Generate QT Tweet"}
                    </button>
                  )}
                </div>
              </div>

              {/* Right Panel: Info + Chat */}
              <div className="space-y-4">
                {/* Article Info */}
                <div className="panel p-4 space-y-3">
                  <h4 className="eyebrow">Article Info</h4>
                  {selectedTrack && (
                    <div className="text-[11px] font-medium px-2.5 py-1 rounded-full inline-block border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-2)]">
                      {TRACK_CONFIG[selectedTrack].emoji} {TRACK_CONFIG[selectedTrack].label}
                    </div>
                  )}
                  {selectedThemes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedThemes.map((t) => (
                        <span key={t} className="text-[11px] bg-[var(--surface-2)] text-[var(--text-2)] px-2 py-0.5 rounded-[var(--r-sm)]">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {inspirationUrls && (
                    <div className="text-[12px] num text-[var(--text-3)]">
                      {inspirationUrls.split("\n").filter(Boolean).length} inspiration URLs
                    </div>
                  )}
                </div>

                {/* Chat Revision Panel */}
                <div className="panel overflow-hidden flex flex-col" style={{ height: "460px" }}>
                  <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between">
                    <h4 className="eyebrow">Revision Chat</h4>
                    <button
                      onClick={onToggleSearch}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-[var(--r-sm)] text-[10px] font-medium border transition ${
                        searchEnabled
                          ? "border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                          : "border-[var(--line)] text-[var(--text-3)] hover:text-[var(--text)]"
                      }`}
                      title={searchEnabled ? "Web search enabled" : "Enable web search for fact-checking"}
                    >
                      🌐 Web Search {searchEnabled ? "ON" : "OFF"}
                    </button>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {chatMessages.length === 0 && (
                      <div className="text-center py-8 space-y-2.5">
                        <p className="text-[var(--text-3)] text-[12px]">Ask Sonnet to revise sections, fact-check claims, or improve the article.</p>
                        <div className="flex flex-wrap justify-center gap-1.5">
                          {["Make the opening punchier", "Is this data accurate?", "Shorten the conclusion"].map((s) => (
                            <button
                              key={s}
                              onClick={() => { onChatInputChange(s); }}
                              className="text-[10px] px-2 py-1 border border-[var(--line)] text-[var(--text-3)] rounded-[var(--r-sm)] hover:text-[var(--text)] hover:border-[var(--line-strong)] transition"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`text-sm ${
                          msg.role === "user"
                            ? "text-right"
                            : "text-left"
                        }`}
                      >
                        <div
                          className={`inline-block max-w-[95%] p-3 rounded-[var(--r-md)] text-[12px] leading-relaxed ${
                            msg.role === "user"
                              ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--text)] border border-[color-mix(in_srgb,var(--accent)_22%,transparent)]"
                              : "bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--line)]"
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                          {msg.searchUsed && (
                            <div className="mt-1.5 text-[10px] text-[var(--accent)] flex items-center gap-1">
                              🌐 Used web search
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="text-left">
                        <div className="inline-block p-3 rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--line)]">
                          <div className="flex items-center gap-2 text-[12px] text-[var(--text-2)]">
                            <span className="animate-pulse">●</span>
                            {searchEnabled ? "Searching & thinking..." : "Thinking..."}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  <div className="p-3 border-t border-[var(--line)]">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => onChatInputChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            onChatSend();
                          }
                        }}
                        placeholder="Ask to revise, fact-check..."
                        className="flex-1 bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-sm)] px-3 py-2 text-[12px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)]"
                        disabled={chatLoading}
                      />
                      <button
                        onClick={onChatSend}
                        disabled={chatLoading || !chatInput.trim()}
                        className="btn-primary px-3 py-2 text-[12px] disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Step 5: Visuals */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-[13px] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
              ← Back
            </button>
            <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[var(--text)]">Article visuals</h2>
          </div>

          <div className="panel p-6 space-y-4">
            <h3 className="eyebrow">Suggested Visuals</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--line)]">
                <div>
                  <p className="text-[13px] font-medium text-[var(--text)]">Hero Image</p>
                  <p className="text-[12px] text-[var(--text-3)]">Wide banner for the top of the article</p>
                </div>
                <button className="btn-ghost px-3 py-1.5 text-[12px]">
                  Generate
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--line)]">
                <div>
                  <p className="text-[13px] font-medium text-[var(--text)]">Timeline Graphic</p>
                  <p className="text-[12px] text-[var(--text-3)]">For the story progression section</p>
                </div>
                <button className="btn-ghost px-3 py-1.5 text-[12px]">
                  Generate
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--line)]">
                <div>
                  <p className="text-[13px] font-medium text-[var(--text)]">Data Visualization</p>
                  <p className="text-[12px] text-[var(--text-3)]">Charts or stats callouts</p>
                </div>
                <button className="btn-ghost px-3 py-1.5 text-[12px]">
                  Generate
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--line-strong)] p-8 text-center">
            <p className="text-[var(--text-2)] text-[13px]">Visual generation coming soon</p>
            <p className="text-[var(--text-3)] text-[12px] mt-1">Placeholder for hero image preview</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Library Tab ──────────────────────────────────────────────────────────────

interface LibraryTabProps {
  articles: Article[];
  loading: boolean;
  editingArticle: Article | null;
  onSetEditingArticle: (a: Article | null) => void;
  onUpdateArticle: (id: string, updates: Partial<Article>) => void;
  onDeleteArticle: (id: string) => void;
  onAddArticle: (article: Partial<Article>) => void;
}

function LibraryTab({
  articles,
  loading,
  editingArticle,
  onSetEditingArticle,
  onUpdateArticle,
  onDeleteArticle,
  onAddArticle,
}: LibraryTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addQtUrl, setAddQtUrl] = useState("");
  const [addTrack, setAddTrack] = useState<Track>("mega-viral");
  const [addDate, setAddDate] = useState(new Date().toISOString().split("T")[0]);
  const [addImpressions, setAddImpressions] = useState("");
  const [addLikes, setAddLikes] = useState("");
  const [addBookmarks, setAddBookmarks] = useState("");
  const [addHeroImage, setAddHeroImage] = useState("");
  const [scraping, setScraping] = useState(false);

  const [addBody, setAddBody] = useState("");

  const [addQtText, setAddQtText] = useState("");
  const [scrapingQt, setScrapingQt] = useState(false);

  const handleFetchQt = async (url: string) => {
    setAddQtUrl(url);
    const tweetIdMatch = url.match(/status\/(\d+)/);
    if (!tweetIdMatch) return;
    setScrapingQt(true);
    try {
      const res = await fetch("/api/articles/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        const data = await res.json();
        // The QT tweet's body IS the QT text
        if (data.body) setAddQtText(data.body);
        else if (data.title) setAddQtText(data.title);
      }
    } finally {
      setScrapingQt(false);
    }
  };

  const handleScrapeUrl = async (url: string) => {
    setAddUrl(url);
    if (!url.startsWith("http")) return;
    setScraping(true);
    try {
      const res = await fetch("/api/articles/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.title) setAddTitle(data.title);
        if (data.body) setAddBody(data.body);
        if (data.heroImageUrl) setAddHeroImage(data.heroImageUrl);
        if (data.impressions != null) setAddImpressions(String(data.impressions));
        if (data.likes != null) setAddLikes(String(data.likes));
        if (data.bookmarks != null) setAddBookmarks(String(data.bookmarks));
        if (data.postedDate) setAddDate(data.postedDate);
        if (data.qtTweet) setAddQtText(data.qtTweet);
        if (data.qtUrl) setAddQtUrl(data.qtUrl);
      }
    } finally {
      setScraping(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {STATUS_COLUMNS.map((status) => (
          <div key={status} className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  // Article Editor Modal
  if (editingArticle) {
    return (
      <ArticleEditor
        article={editingArticle}
        onClose={() => onSetEditingArticle(null)}
        onUpdate={(updates) => {
          onUpdateArticle(editingArticle.id, updates);
          onSetEditingArticle({ ...editingArticle, ...updates });
        }}
        onDelete={() => onDeleteArticle(editingArticle.id)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Past Article */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-ghost px-3 py-1.5 text-[12px]"
        >
          {showAddForm ? "Cancel" : "+ Add Past Article"}
        </button>
      </div>

      {showAddForm && (
        <div className="panel p-5 space-y-4">
          <h3 className="text-[14px] font-semibold text-[var(--text)]">Add an article you already posted</h3>

          {/* URL input — auto-fetches on paste */}
          <div className="space-y-1.5">
            <label className="eyebrow">Article URL (paste to auto-fill)</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (pasted.startsWith("http")) {
                    setTimeout(() => handleScrapeUrl(pasted), 100);
                  }
                }}
                placeholder="https://x.com/yourhandle/status/..."
                className="flex-1 bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-sm)] p-2 text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)]"
              />
              <button
                onClick={() => handleScrapeUrl(addUrl)}
                disabled={scraping || !addUrl.startsWith("http")}
                className="btn-ghost px-3 py-2 text-[12px] disabled:opacity-50"
              >
                {scraping ? "Fetching..." : "Fetch"}
              </button>
            </div>
            {scraping && (
              <p className="text-[10px] text-[var(--accent)] animate-pulse">Fetching title, image, and metrics...</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="eyebrow">Title</label>
              <input
                type="text"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="Article title..."
                className="w-full bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-sm)] p-2 text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="eyebrow">QT Tweet URL (paste to fetch text)</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={addQtUrl}
                  onChange={(e) => setAddQtUrl(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text");
                    if (pasted.includes("status/")) {
                      setTimeout(() => handleFetchQt(pasted), 100);
                    }
                  }}
                  placeholder="https://x.com/yourhandle/status/..."
                  className="flex-1 bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-sm)] p-2 text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)]"
                />
                <button
                  onClick={() => handleFetchQt(addQtUrl)}
                  disabled={scrapingQt || !addQtUrl.includes("status/")}
                  className="btn-ghost px-3 py-2 text-[12px] disabled:opacity-50"
                >
                  {scrapingQt ? "..." : "Fetch"}
                </button>
              </div>
              {addQtText && (
                <div className="mt-2 p-3 bg-[var(--surface-2)] border border-[var(--line)] rounded-[var(--r-sm)]">
                  <p className="eyebrow mb-1">QT Text (fetched)</p>
                  <p className="text-[12px] text-[var(--text-2)] whitespace-pre-wrap">{addQtText}</p>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="eyebrow">Track</label>
              <select
                value={addTrack}
                onChange={(e) => setAddTrack(e.target.value as Track)}
                className="w-full bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-sm)] p-2 text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--line-strong)]"
              >
                <option value="mega-viral">Mega Viral</option>
                <option value="local-viral">Local Viral</option>
                <option value="icp-viral">ICP Viral</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="eyebrow">Posted Date</label>
              <input
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
                className="w-full bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-sm)] p-2 text-[13px] num text-[var(--text)] focus:outline-none focus:border-[var(--line-strong)] [color-scheme:dark]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="eyebrow">Impressions</label>
              <input
                type="number"
                value={addImpressions}
                onChange={(e) => setAddImpressions(e.target.value)}
                placeholder="0"
                className="w-full bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-sm)] p-2 text-[13px] num text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="eyebrow">Likes</label>
                <input
                  type="number"
                  value={addLikes}
                  onChange={(e) => setAddLikes(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-sm)] p-2 text-[13px] num text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="eyebrow">Bookmarks</label>
                <input
                  type="number"
                  value={addBookmarks}
                  onChange={(e) => setAddBookmarks(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-sm)] p-2 text-[13px] num text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)]"
                />
              </div>
            </div>
          </div>

          {/* Hero image preview */}
          {addHeroImage && (
            <div className="space-y-1.5">
              <label className="eyebrow">Hero Image (auto-fetched)</label>
              <div className="rounded-[var(--r-sm)] overflow-hidden border border-[var(--line)] max-h-32">
                <img src={addHeroImage} alt="Hero" className="w-full h-32 object-cover" />
              </div>
            </div>
          )}

          <button
            onClick={() => {
              if (!addTitle.trim()) return;
              onAddArticle({
                title: addTitle,
                body: addBody,
                track: addTrack,
                status: "posted",
                postedUrl: addUrl || null,
                qtTweet: addQtText || null,
                qtUrl: addQtUrl || null,
                heroImageUrl: addHeroImage || null,
                postedAt: addDate ? new Date(addDate).toISOString() : new Date().toISOString(),
                scheduledDate: addDate || null,
                impressions: addImpressions ? Number(addImpressions) : null,
                likes: addLikes ? Number(addLikes) : null,
                bookmarks: addBookmarks ? Number(addBookmarks) : null,
              });
              setShowAddForm(false);
              setAddTitle("");
              setAddBody("");
              setAddUrl("");
              setAddQtUrl("");
              setAddQtText("");
              setAddImpressions("");
              setAddLikes("");
              setAddBookmarks("");
              setAddHeroImage("");
            }}
            disabled={!addTitle.trim()}
            className="btn-primary px-4 py-2 text-[13px] disabled:opacity-40 disabled:pointer-events-none"
          >
            Add Article
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {STATUS_COLUMNS.map((status) => {
          const statusArticles = articles.filter((a) => a.status === status);
          const statusConfig = {
            idea: { label: "Ideas" },
            draft: { label: "Drafts" },
            ready: { label: "Ready" },
            posted: { label: "Posted" },
          }[status];

          return (
            <div key={status} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="eyebrow">
                  {statusConfig.label}
                </span>
                <span className="text-[11px] num text-[var(--text-4)]">{statusArticles.length}</span>
              </div>
              <div className="space-y-2.5">
                {statusArticles.map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    onClick={() => onSetEditingArticle(article)}
                  />
                ))}
                {statusArticles.length === 0 && (
                  <div className="text-[12px] text-[var(--text-4)] py-4 text-center border border-dashed border-[var(--line)] rounded-[var(--r-md)]">
                    No {status} articles
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Article Card ─────────────────────────────────────────────────────────────

function ArticleCard({ article, onClick }: { article: Article; onClick: () => void }) {
  const trackConfig = TRACK_CONFIG[article.track];
  const wordCount = article.body?.split(/\s+/).filter(Boolean).length || 0;

  return (
    <button
      onClick={onClick}
      className="panel panel-interactive w-full text-left overflow-hidden"
    >
      {article.heroImageUrl && (
        <div
          className="w-full h-24 bg-cover bg-center"
          style={{ backgroundImage: `url(${article.heroImageUrl})` }}
        />
      )}
      <div className="p-4">
      <div className="flex items-start gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full mt-1.5 ${trackConfig.color.replace("text-", "bg-")}`} />
        <h3 className="text-sm font-medium line-clamp-2">{article.title || "Untitled"}</h3>
      </div>
      <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
        <span><span className="num">{wordCount}</span> words</span>
        <span>·</span>
        <span>{new Date(article.createdAt).toLocaleDateString()}</span>
      </div>
      {article.qtTweet && (
        <p className="text-xs text-[var(--text-4)] mt-2 line-clamp-2 italic">
          {article.qtTweet}
        </p>
      )}
      {article.status === "posted" && article.impressions != null && (
        <div className="flex gap-2 text-xs text-[var(--text-3)] mt-2">
          <span>👀 {article.impressions.toLocaleString()}</span>
          {article.likes != null && <span>❤️ {article.likes.toLocaleString()}</span>}
        </div>
      )}
      </div>
    </button>
  );
}

// ─── Article Editor ───────────────────────────────────────────────────────────

function ArticleEditor({
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
    const updates: Partial<Article> & Record<string, any> = {
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

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

interface CalendarTabProps {
  articles: Article[];
  weekDays: { date: string; label: string; dayName: string; isToday: boolean }[];
  weekOffset: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onUpdateArticle: (id: string, updates: Partial<Article>) => void;
  onOpenArticle: (article: Article) => void;
}

function CalendarTab({
  articles,
  weekDays,
  weekOffset,
  onPrevWeek,
  onNextWeek,
  onToday,
  onUpdateArticle,
  onOpenArticle,
}: CalendarTabProps) {
  const handleDrop = (date: string, articleId: string) => {
    onUpdateArticle(articleId, { scheduledDate: date });
  };

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevWeek}
            className="px-3 py-1.5 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] rounded-[var(--r-md)] text-sm text-[var(--text)]"
          >
            ← Prev
          </button>
          <button
            onClick={onToday}
            className={`px-3 py-1.5 rounded-[var(--r-md)] text-sm ${
              weekOffset === 0
                ? "bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--accent)]"
                : "bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)]"
            }`}
          >
            Today
          </button>
          <button
            onClick={onNextWeek}
            className="px-3 py-1.5 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] rounded-[var(--r-md)] text-sm text-[var(--text)]"
          >
            Next →
          </button>
        </div>
        <span className="text-sm text-[var(--text-2)]">
          {weekDays[0]?.label} - {weekDays[6]?.label}
        </span>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const dayArticles = articles.filter((a) => a.scheduledDate === day.date);

          return (
            <div
              key={day.date}
              className={`min-h-[200px] p-3 rounded-[var(--r-lg)] border ${
                day.isToday
                  ? "border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]"
                  : "border-[var(--line)] bg-[var(--surface-1)]"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const articleId = e.dataTransfer.getData("text/plain");
                if (articleId) handleDrop(day.date, articleId);
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-xs font-medium ${
                    day.isToday ? "text-[var(--accent)]" : "text-[var(--text-3)]"
                  }`}
                >
                  {day.dayName}
                </span>
                <span
                  className={`text-xs num ${
                    day.isToday ? "text-[var(--accent)]" : "text-[var(--text-4)]"
                  }`}
                >
                  {day.label}
                </span>
              </div>

              <div className="space-y-2">
                {dayArticles.map((article) => {
                  const trackConfig = TRACK_CONFIG[article.track];
                  return (
                    <div
                      key={article.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", article.id);
                      }}
                      onClick={() => onOpenArticle(article)}
                      className={`p-2 rounded-lg border cursor-pointer hover:brightness-125 transition ${trackConfig.bgColor} ${trackConfig.borderColor}`}
                    >
                      {article.heroImageUrl && (
                        <div
                          className="w-full h-12 rounded bg-cover bg-center mb-2"
                          style={{ backgroundImage: `url(${article.heroImageUrl})` }}
                        />
                      )}
                      <p className="text-xs font-medium line-clamp-2">
                        {article.title || "Untitled"}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${trackConfig.color.replace(
                            "text-",
                            "bg-"
                          )}`}
                        />
                        <span className="text-[10px] text-[var(--text-3)]">
                          {trackConfig.label}
                        </span>
                      </div>
                      {article.status === "posted" && article.impressions != null && (
                        <div className="text-[10px] text-[var(--text-3)] mt-1">
                          👀 {article.impressions.toLocaleString()}
                          {article.likes != null && ` · ❤️ ${article.likes.toLocaleString()}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unscheduled Articles */}
      <div className="border-t border-[var(--line)] pt-4 mt-6">
        <h3 className="text-sm font-semibold mb-3 text-[var(--text-2)]">
          Unscheduled Articles (drag to calendar)
        </h3>
        <div className="flex flex-wrap gap-2">
          {articles
            .filter((a) => !a.scheduledDate && a.status !== "posted")
            .map((article) => {
              const trackConfig = TRACK_CONFIG[article.track];
              return (
                <div
                  key={article.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", article.id);
                  }}
                  className={`p-2 rounded-lg border cursor-move max-w-[200px] ${trackConfig.bgColor} ${trackConfig.borderColor}`}
                >
                  <p className="text-xs font-medium line-clamp-1">
                    {article.title || "Untitled"}
                  </p>
                  <span className="text-[10px] text-[var(--text-3)]">{article.status}</span>
                </div>
              );
            })}
          {articles.filter((a) => !a.scheduledDate && a.status !== "posted").length === 0 && (
            <p className="text-xs text-[var(--text-4)]">All articles are scheduled or posted</p>
          )}
        </div>
      </div>
    </div>
  );
}
