// Shared Decision UI constants — single source of truth for kind/status badges.
// Extracted from decision-dashboard-widget.tsx, decision-detail-modal.tsx,
// and admin/decisions/page.tsx to prevent drift.

import type {
  DecisionKind,
  DecisionStatus,
} from "@/types/decision";

export interface BadgeDef {
  label: string;
  color: string;
}

// Kind badges — semantically aligned with the dashboard's visual language:
//   archive  → down (red)   = removal / hide from active view
//   pin      → accent (blue) = prioritize / keep visible
//   resolve  → up (green)    = mark complete / done
//   confirm  → warn (yellow) = awaiting operator verification
export const KIND_BADGE: Record<DecisionKind, BadgeDef> = {
  archive: { label: "Archive", color: "var(--down)" },
  pin: { label: "Pin", color: "var(--accent)" },
  resolve: { label: "Resolve", color: "var(--up)" },
  confirm: { label: "Confirm", color: "var(--warn)" },
};

// Status badges — unchanged from previous mapping.
export const STATUS_BADGE: Record<DecisionStatus, BadgeDef> = {
  pending: { label: "Pending", color: "var(--warn)" },
  approved: { label: "Approved", color: "var(--up)" },
  dismissed: { label: "Dismissed", color: "var(--text-3)" },
  resolved: { label: "Resolved", color: "var(--up)" },
};