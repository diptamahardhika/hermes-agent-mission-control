"use client";

import type { Article } from "@/lib/articles-config";
import { TRACK_CONFIG } from "@/lib/articles-config";

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

export function CalendarTab({
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
