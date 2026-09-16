"use client";

import { useState } from "react";
import { Panel, Button } from "@/components/ui/kit";
import { ErrorBoundary } from "@/components/error-boundary";
import * as Sentry from "@sentry/nextjs";

// Component that throws a synchronous error
function ThrowSyncError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Client-side sync error for Sentry test");
  }
  return <div className="text-[11px] text-[var(--hq-text-ghost)]">No error thrown</div>;
}

// Component that throws an async error
function ThrowAsyncError({ shouldThrow }: { shouldThrow: boolean }) {
  const [error, setError] = useState<Error | null>(null);
  
  const triggerAsyncError = async () => {
    try {
      await new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Client-side async error for Sentry test")), 100)
      );
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  };
  
  if (error) {
    throw error;
  }
  
  return (
    <Button 
      variant="ghost" 
      size="sm"
      onClick={triggerAsyncError}
      disabled={shouldThrow}
    >
      Trigger Async Error
    </Button>
  );
}

// Component that triggers a React error boundary test
function ErrorBoundaryTest() {
  const [throwSync, setThrowSync] = useState(false);
  const [throwAsync, setThrowAsync] = useState(false);
  const [showErrorBoundary, setShowErrorBoundary] = useState(true);

  const testSentryCapture = () => {
    // Test manual Sentry capture
    Sentry.captureMessage("Manual test message from client", "info");
    Sentry.addBreadcrumb({
      category: "test.manual",
      message: "Manual breadcrumb test",
      level: "info",
      data: { timestamp: Date.now() },
    });
    alert("Check Sentry for 'Manual test message from client' and breadcrumb");
  };

  const testCaptureException = () => {
    try {
      throw new Error("Manual captureException test");
    } catch (error) {
      Sentry.captureException(error, {
        tags: { test: "manual-capture" },
        extra: { customData: "test-value" },
      });
      alert("Check Sentry for captured exception with custom tags");
    }
  };

  const testUserFeedback = () => {
    try {
      throw new Error("User feedback test error");
    } catch (error) {
      const eventId = Sentry.captureException(error);
      Sentry.showReportDialog({ eventId });
    }
  };

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <h3 className="text-sm font-medium mb-3">Error Boundary Tests</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[11px]">
            <input 
              type="checkbox" 
              checked={showErrorBoundary}
              onChange={(e) => setShowErrorBoundary(e.target.checked)}
              className="rounded border-[var(--border)]"
            />
            Wrap in ErrorBoundary
          </label>
          <label className="flex items-center gap-2 text-[11px]">
            <input 
              type="checkbox" 
              checked={throwSync}
              onChange={(e) => setThrowSync(e.target.checked)}
              className="rounded border-[var(--border)]"
            />
            Throw sync error
          </label>
        </div>
        
        {showErrorBoundary ? (
          <ErrorBoundary name="ErrorBoundaryTest">
            <ThrowSyncError shouldThrow={throwSync} />
          </ErrorBoundary>
        ) : (
          <ThrowSyncError shouldThrow={throwSync} />
        )}
      </Panel>

      <Panel className="p-4">
        <h3 className="text-sm font-medium mb-3">Async Error Test</h3>
        <ErrorBoundary name="AsyncErrorTest">
          <ThrowAsyncError shouldThrow={throwAsync} />
        </ErrorBoundary>
      </Panel>

      <Panel className="p-4">
        <h3 className="text-sm font-medium mb-3">Sentry Direct Tests</h3>
        <div className="flex flex-wrap gap-2">
<Button variant="ghost" size="sm" onClick={testSentryCapture}>
        captureMessage()
      </Button>
      <Button variant="ghost" size="sm" onClick={testCaptureException}>
        captureException()
      </Button>
      <Button variant="ghost" size="sm" onClick={testUserFeedback}>
        showReportDialog()
      </Button>
        </div>
      </Panel>

      <Panel className="p-4">
        <h3 className="text-sm font-medium mb-3">API Error Tests</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => testApiError("sync")}>
            Sync API Error
          </Button>
          <Button variant="ghost" size="sm" onClick={() => testApiError("async")}>
            Async API Error
          </Button>
          <Button variant="ghost" size="sm" onClick={() => testApiError("validation")}>
            Validation Error (400)
          </Button>
          <Button variant="ghost" size="sm" onClick={() => testApiError("breadcrumbs")}>
            With Breadcrumbs
          </Button>
        </div>
      </Panel>
    </div>
  );
}

async function testApiError(type: string) {
  try {
    const res = await fetch(`/api/debug/sentry-test?type=${type}`);
    const data = await res.json();
    alert(`Status: ${res.status}\nResponse: ${JSON.stringify(data, null, 2)}`);
  } catch (error) {
    alert(`Fetch failed: ${error}`);
  }
}

export default function SentryTestPage() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-medium mb-1">Sentry Integration Test</h1>
        <p className="text-[11px] text-[var(--hq-text-ghost)]">
          Test client-side and server-side error tracking with Sentry
        </p>
      </div>
      
      <ErrorBoundaryTest />
    </div>
  );
}