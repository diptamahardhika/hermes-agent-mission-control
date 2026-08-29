"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Check, X, AlertTriangle, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ToastTone = "up" | "down" | "warn" | "accent";

interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  duration: number;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "accent", duration = 3000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, tone, duration }]);

      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const success = useCallback(
    (message: string, duration?: number) => toast(message, "up", duration),
    [toast]
  );
  const error = useCallback(
    (message: string, duration?: number) => toast(message, "down", duration),
    [toast]
  );
  const warning = useCallback(
    (message: string, duration?: number) => toast(message, "warn", duration),
    [toast]
  );
  const info = useCallback(
    (message: string, duration?: number) => toast(message, "accent", duration),
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

// ── Icons per tone ────────────────────────────────────────
const TONE_ICON: Record<ToastTone, LucideIcon> = {
  up: Check,
  down: X,
  warn: AlertTriangle,
  accent: Info,
};

// ── Container ──────────────────────────────────────────────
function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-[200] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ── Single toast ──────────────────────────────────────────
const TONE_COLORS: Record<
  ToastTone,
  { text: string; bg: string; border: string; icon: string }
> = {
  up: {
    text: "var(--up)",
    bg: "rgba(52, 211, 153, 0.08)",
    border: "rgba(52, 211, 153, 0.2)",
    icon: "var(--up)",
  },
  down: {
    text: "var(--down)",
    bg: "rgba(251, 113, 133, 0.08)",
    border: "rgba(251, 113, 133, 0.2)",
    icon: "var(--down)",
  },
  warn: {
    text: "var(--warn)",
    bg: "rgba(245, 196, 81, 0.08)",
    border: "rgba(245, 196, 81, 0.2)",
    icon: "var(--warn)",
  },
  accent: {
    text: "var(--accent)",
    bg: "rgba(110, 168, 254, 0.08)",
    border: "rgba(110, 168, 254, 0.2)",
    icon: "var(--accent)",
  },
};

function ToastItem({
  toast: t,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const Icon = TONE_ICON[t.tone];
  const colors = TONE_COLORS[t.tone];

  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center gap-3 rounded-[var(--r-md)] px-4 py-3 min-w-[280px] max-w-[380px] border transition-all duration-300 ease-out motion-safe:animate-[hq-toast-in_0.25s_cubic-bezier(0.16,1,0.3,1)]"
      style={{
        background: colors.bg,
        borderColor: colors.border,
        color: colors.text,
        boxShadow:
          "0 8px 24px -6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <Icon className="w-4 h-4 shrink-0" strokeWidth={2.5} />
      <span className="text-[13px] font-medium flex-1 leading-snug">{t.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(t.id)}
        aria-label="Dismiss notification"
        className="shrink-0 p-1 rounded-md transition-colors hover:bg-white/[0.06] text-[var(--text-3)] hover:text-[var(--text)]"
        style={{ color: "inherit", opacity: 0.6 }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
