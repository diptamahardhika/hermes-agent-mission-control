"use client";
import { Component, ReactNode } from "react";
import { Panel } from "@/components/ui/kit";
interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return <Panel className="p-6"><div className="flex items-center gap-2 mb-2"><span className="text-[11px] text-[var(--hq-down)]">Panel error</span></div><p className="text-[11px] text-[var(--hq-text-ghost)]">{this.state.error?.message || "Unknown error"}</p></Panel>;
    }
    return this.props.children;
  }
}
