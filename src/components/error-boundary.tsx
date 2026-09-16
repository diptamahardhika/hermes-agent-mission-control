"use client";
import { Component, ReactNode, ErrorInfo } from "react";
import { Panel } from "@/components/ui/kit";
import * as Sentry from "@sentry/nextjs";

interface Props { 
  children: ReactNode; 
  fallback?: ReactNode;
  name?: string; // Component name for better error tracking
}
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { 
    super(props); 
    this.state = { hasError: false, error: null }; 
  }
  
  static getDerivedStateFromError(error: Error): State { 
    return { hasError: true, error }; 
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console for local debugging
    console.error(`[ErrorBoundary] ${this.props.name || "Component"}:`, error, errorInfo);
    
    // Send to Sentry with context
    Sentry.captureException(error, {
      tags: {
        component: this.props.name || "UnknownComponent",
        errorBoundary: true,
      },
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
    
    // Add breadcrumb for context
    Sentry.addBreadcrumb({
      category: "ui.error",
      message: `Error boundary caught error in ${this.props.name || "component"}`,
      level: "error",
      data: { 
        component: this.props.name,
        errorMessage: error.message,
      },
    });
  }
  
  render() {
    if (this.state.hasError) {
      // If custom fallback provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Default fallback UI
      return (
        <Panel className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] text-[var(--hq-down)]">Panel error</span>
          </div>
          <p className="text-[11px] text-[var(--hq-text-ghost)]">
            {this.state.error?.message || "Unknown error"}
          </p>
          {process.env.NODE_ENV === "development" && (
            <details className="mt-2 text-left text-[10px] text-[var(--hq-text-ghost)]">
              <summary className="cursor-pointer mb-1">Technical details (dev only)</summary>
              <pre className="bg-[var(--bg-elevated)] p-2 rounded text-xs overflow-auto max-h-40">
                {this.state.error?.stack || "No stack trace"}
              </pre>
            </details>
          )}
        </Panel>
      );
    }
    return this.props.children;
  }
}
