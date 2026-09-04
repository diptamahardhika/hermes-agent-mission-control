// Shared types for Decision layer (Phase 2.1/2.2/2.3)

export type DecisionKind = "archive" | "pin" | "resolve" | "confirm";
export type DecisionAction = "approve" | "dismiss" | "open" | "edit";
export type DecisionStatus = "pending" | "approved" | "dismissed" | "resolved";

export interface DecisionActionTarget {
  type: "task" | "request" | "path";
  id?: string;
  hash?: string;
}

export interface Decision {
  id: string;
  key: string;
  title: string;
  body: string;
  kind: DecisionKind;
  status: DecisionStatus;
  actionTarget?: DecisionActionTarget | null;
  actions: DecisionAction[];
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string | null;
}