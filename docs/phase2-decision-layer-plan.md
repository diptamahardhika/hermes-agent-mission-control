# HermesBriefing Decision Layer - Phase 2 Plan

## Overview
Preparation for structured decision support without breaking existing UI. Uses union type fallback and feature flag for gradual adoption.

---

## Phase 2: Union Type Fallback + Feature Flag

### Goal
Enable structured `Decision` objects in briefing items while preserving backward compatibility with legacy string items.

### Changes Required

#### 1. TypeScript Type Updates
```typescript
interface Decision {
  id: string;                    // deterministic slug from content
  title: string;                 // human-readable headline
  body: string;                  // full context (shown expanded)
  kind: "archive" | "pin" | "resolve" | "confirm";
  actionTarget?: {
    type: "task" | "request" | "path";
    id?: string;
    hash?: string;
  };
  actions: ("approve" | "dismiss" | "open" | "edit")[];
  metadata?: Record<string, unknown>; // extensibility
}

// Union type for backward compatibility
type DecisionItem = string | Decision;

interface Section { 
  label: string; 
  items: DecisionItem[];  // CHANGED: was string[]
}

interface Briefing {
  generatedAt: string | null;
  greeting?: string | null;
  summary: string | null;
  sections?: Section[];
  decisionLayer?: "legacy" | "structured";  // NEW: feature toggle signal
}
```

#### 2. Component Updates
**File:** `src/components/hermes-briefing.tsx`

**Changes:**
- Add `renderDecisionItem()` helper to handle both string and Decision types
- Use union type in `items.map()` callback
- Preserve existing expand/collapse UX for strings
- Add new action buttons for Decision type (approve/dismiss/edit based on `actions` array)

**Draft Implementation:**
```typescript
function renderDecisionItem(item: DecisionItem, key: string) {
  if (typeof item === "string") {
    return <LegacyItem item={item} key={key} />;  // existing UI
  }
  
  const expanded = expandedMap[key] || false;
  
  return (
    <div key={key} className="decision-card ...">
      <button onClick={() => toggleExpand(key)}>
        {item.title}
        {expanded ? '▼' : '▶'}
      </button>
      
      {expanded && (
        <div className="decision-detail">
          <p>{item.body}</p>
          <div className="decision-actions">
            {item.actions.includes("approve") && (
              <button onClick={() => handleApprove(item.id)}>Approve</button>
            )}
            {item.actions.includes("dismiss") && (
              <button onClick={() => handleDismiss(item.id)}>Dismiss</button>
            )}
            {item.actions.includes("open") && (
              <button onClick={() => handleOpen(item.actionTarget?.hash || item.actionTarget?.id)}>
                Open
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 3. Feature Flag System
**File:** `src/lib/features.ts` (NEW)

```typescript
export const FEATURES = {
  DECISION_LAYER: {
    LEGACY: "legacy",
    STRUCTURED: "structured",
    
    getCurrent: (): "legacy" | "structured" => {
      // Check local storage first (for testing)
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("hermes.decision_layer");
        if (stored === "structured" || stored === "legacy") return stored;
      }
      
      // Fall back to briefing metadata
      // This will be populated in Component after first load
      return globalThis.__HERMES_DECISION_LAYER || "legacy";
    },
    
    // For testing: allow manual override
    setForTesting: (value: "legacy" | "structured") => {
      globalThis.__HERMES_DECISION_LAYER = value;
    }
  }
};
```

**Component Integration:**
```typescript
// In HermesBriefing component:
const [decisionLayer, setDecisionLayer] = useState<"legacy" | "structured">("legacy");

useEffect(() => {
  if (data?.decisionLayer) {
    setDecisionLayer(data.decisionLayer);
  }
}, [data]);

// Then use FEATURES.DECISION_LAYER.getCurrent() in render
```

#### 4. API Endpoints
**NEW Endpoint:** `PATCH /api/hermes/decisions/:id`

**File:** `src/app/api/hermes/decisions/[id]/route.ts` (NEW)

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const action = (b.action || "").toString(); // approve | dismiss | open

  // Validate action
  if (!["approve", "dismiss", "open"].includes(action)) {
    return NextResponse.json(
      { error: "action must be approve|dismiss|open" },
      { status: 400 }
    );
  }

  // Route to appropriate handler based on kind and actionTarget
  // For now: log and return success (stub)
  console.log(`Decision ${id} action: ${action}`);
  
  // TODO: Implement actual routing logic
  // - archive → trigger Hermes to archive related task/request
  // - pin → add metadata to Hermes system
  // - resolve → mark as resolved in kanban/memory
  
  return NextResponse.json({ success: true, action });
}
```

---

## Migration Strategy

### Timeline
1. **Phase 2.1** (This sprint): Union type + feature flag, backend stubs
2. **Phase 2.2** (Next sprint): Wire up real handlers, test with Hermes bridge
3. **Phase 3**: Full Layer 3 integration (auto-wiring, bridge enhancements)

### Rollout Plan
- **Week 1:** Deploy Phase 2.1 with feature flag defaulting to "legacy"
- **Week 2:** Test "structured" mode with Hermes team
- **Week 3:** Gradual adoption, collect feedback
- **Week 4:** Consider defaulting to "structured" after validation

### Backward Compatibility
- All existing briefings with `string[]` items continue to work
- New structured items are opt-in via feature flag or Hermes bridge update
- UI renders legacy items identically to current behavior

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hermes bridge doesn't emit structured decisions | Low | Feature flag keeps it in "legacy" mode |
| Frontend breaks with malformed Decision objects | Medium | Type guards + graceful fallback to legacy render |
| Feature flag complexity increases code | Low | Single source of truth in `features.ts` |
| State management complexity grows | Low | Keep expand/collapse separate from decision type handling |

---

## Dependencies

### Ready
- ✅ Phase 1 implemented and verified
- ✅ Component structure understood
- ✅ API patterns documented (`/api/hermes/requests/[id]`, `/api/hermes/tasks`)

### Required
- Hermes bridge team coordination (for backend implementation)
- Decision data model finalization (what fields are needed)
- UX validation of new action buttons

### Optional
- LocalStorage persistence for feature flag preference
- A/B testing framework for structured vs legacy

---

## Implementation Checklist

### Frontend
- [ ] Add `Decision` type definitions
- [ ] Update `Section.items` to `DecisionItem[]`
- [ ] Add `renderDecisionItem()` helper
- [ ] Create `features.ts` with feature flag system
- [ ] Integrate feature flag into `HermesBriefing`
- [ ] Add new action buttons (approve/dismiss/edit)
- [ ] Handle missing/malformed Decision objects gracefully

### Backend
- [ ] Create `PATCH /api/hermes/decisions/[id]` endpoint (stub)
- [ ] Document endpoint contract for Hermes team
- [ ] Add logging/metrics for decision actions

### Documentation
- [ ] Update API docs with new endpoint
- [ ] Document Decision object schema
- [ ] Add migration guide for Hermes bridge

---

## Verification Criteria

### Unit Tests
- [ ] Legacy string items render correctly
- [ ] Structured Decision items render correctly
- [ ] Feature flag switches between modes
- [ ] Malformed Decision objects fall back to legacy render
- [ ] Action buttons trigger correct handlers

### Integration Tests
- [ ] Decision actions call correct API endpoints
- [ ] Backend stub returns expected responses
- [ ] Feature flag persists across component re-renders

### Manual Testing
- [ ] Click expand/collapse on legacy items
- [ ] Click expand/collapse on structured items
- [ ] Test approve/dismiss/open actions
- [ ] Verify "Open in Hermes" navigates correctly
- [ ] Test feature flag toggle (if UI control added)

---

## Files to Create/Modify

### New Files
- `src/lib/features.ts` - Feature flag system
- `src/app/api/hermes/decisions/[id]/route.ts` - Decision action endpoint

### Modified Files
- `src/components/hermes-briefing.tsx` - Union type handling
- `src/components/ui/kit.tsx` - Optional: Add Decision-specific components

### Documentation
- `docs/api/decisions.md` - API documentation
- `docs/migration/decisions.md` - Migration guide

---

## Next Actions

1. **Review this plan** with Hermes bridge team
2. **Finalize Decision schema** (what fields are actually needed)
3. **Create implementation ticket** in project tracker
4. **Schedule Phase 2 kickoff** (separate from current work)
5. **Prepare verification environment** (Hermes instance with test data)

---

**Status:** Phase 2 PLANNED (not implemented)  
**Ready for:** Implementation kickoff after approval
