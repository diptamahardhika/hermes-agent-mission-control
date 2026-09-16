import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ConditionalLayout } from "@/components/conditional-layout";
import { ToastProvider } from "@/components/ui/toast/toast-context";
import * as Sentry from "@sentry/nextjs";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Hermy HQ",
  description: "Your command center",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Wrap the root layout with Sentry's ErrorBoundary for client-side error catching
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("hermy_sidebar_open")?.value !== "false";

  return (
    <html lang="en" dir="ltr" className="dark">
      <body className={`${geist.variable} ${geistMono.variable} ${geist.className} bg-[var(--bg)] text-[var(--foreground)] min-h-screen`}>
        <Sentry.ErrorBoundary
          fallback={(errorData) => <SentryFallback {...errorData} />}
          onError={(error, errorInfo) => {
            console.error("[Sentry] Root layout error:", error, errorInfo);
            // Add custom tags for better filtering
            Sentry.addBreadcrumb({
              category: "ui",
              message: "Root layout error boundary triggered",
              level: "error",
              data: { component: "RootLayout" },
            });
          }}
        >
          <ToastProvider>
            <ConditionalLayout sidebarOpen={sidebarOpen}>{children}</ConditionalLayout>
          </ToastProvider>
        </Sentry.ErrorBoundary>
      </body>
    </html>
  );
}

// User-facing error display (non-sensitive)
function SentryFallback({ error, resetError }: { error: unknown; componentStack: string; eventId: string; resetError: () => void }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <div className="flex items-center justify-center gap-2 text-[var(--hq-down)]">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-sm font-medium">Something went wrong</span>
        </div>
        <p className="text-[11px] text-[var(--hq-text-ghost)]">
          We&apos;ve been notified and are looking into it. Your data is safe.
        </p>
        {process.env.NODE_ENV === "development" && (
          <details className="text-left text-[10px] text-[var(--hq-text-ghost)]">
            <summary className="cursor-pointer mb-1">Technical details (dev only)</summary>
            <pre className="bg-[var(--bg-elevated)] p-2 rounded text-xs overflow-auto max-h-40">
              {error instanceof Error ? error.message : String(error || "Unknown error")}
            </pre>
          </details>
        )}
        <button
          onClick={resetError}
          className="mt-2 px-3 py-1.5 text-[11px] font-medium text-[var(--bg)] bg-[var(--hq-up)] rounded hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
