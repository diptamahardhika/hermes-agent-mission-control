/**
 * Feature flags for Hermes Agent Mission Control
 * 
 * Phase 2.1: Decision layer feature flag
 * Controls whether the brief uses legacy string items or structured Decision objects
 */

// Global state for testing/override
declare global {
  interface Window {
    __HERMES_FEATURES?: Record<string, "legacy" | "structured" | "enabled" | "disabled">;
  }
}

export const FEATURES = {
  DECISION_LAYER: {
    LEGACY: "legacy" as const,
    STRUCTURED: "structured" as const,

    getCurrent(): "legacy" | "structured" {
      // 1. Check window-level override (for testing)
      if (typeof window !== "undefined" && window.__HERMES_FEATURES?.decisionLayer) {
        const val = window.__HERMES_FEATURES.decisionLayer;
        if (val === "structured" || val === "legacy") return val;
      }

      // 2. Check localStorage (persistent user preference)
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem("hermes.decision_layer");
        if (stored === "structured" || stored === "legacy") return stored;
      }

      // 3. Default to legacy for backward compatibility
      return "legacy";
    },

    // For manual override during development/testing
    set(value: "legacy" | "structured"): void {
      if (typeof window !== "undefined") {
        if (!window.__HERMES_FEATURES) {
          window.__HERMES_FEATURES = {};
        }
        window.__HERMES_FEATURES.decisionLayer = value;
      }
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("hermes.decision_layer", value);
      }
    },

    // Check if structured mode is active
    isStructured(): boolean {
      return this.getCurrent() === "structured";
    }
  },

  // Add more feature flags here as needed
  // EXAMPLE:
  // NEW_DASHBOARD: {
  //   enabled: () => FEATURES.NEW_DASHBOARD.getCurrent() === "enabled",
  //   getCurrent: (): "enabled" | "disabled" => { ... }
  // }
};

/**
 * Helper to get decision layer from briefing data
 * Useful when briefing is loaded but feature flag hasn't been checked yet
 */
export function getDecisionLayerFromBriefing(briefing: { decisionLayer?: string | null }): "legacy" | "structured" {
  if (briefing.decisionLayer === "structured") return "structured";
  if (briefing.decisionLayer === "legacy") return "legacy";
  return FEATURES.DECISION_LAYER.getCurrent();
}
