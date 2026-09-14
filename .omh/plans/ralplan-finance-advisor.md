# Finance Advisor Bot — Consensus Implementation Plan

## Consensus Status

- **Rounds**: 1 (Planner → Architect + Critic in parallel → consensus reached with modifications)
- **Verdicts**:
  - **Planner**: APPROVED with reservations (Sure scraping feasibility concerns)
  - **Architect**: APPROVED with significant modifications (scraping rejected, profile structure fixed, separate page recommended)
  - **Critic**: REQUEST_CHANGES (blocking issue: Sure dashboard login wall makes scraping infeasible; scope creep identified)
- **Consensus**: REACHED after incorporating Architect+Critic feedback

## What Changed from Original Plan

| Original | Revised | Reason |
|----------|---------|--------|
| Scrape Sure dashboard | Use proper financial APIs (Binance, Hyperliquid, CoinGecko) | Sure has login wall + CSRF; scraping is infeasible and fragile |
| Panel on hermy-hq home page | Separate `/coq` page | page.tsx is 2128 lines; adding panels creates maintenance burden |
| `/api/coq-findings` route | `/api/coq` route | Cleaner naming, consistent with existing `/api/freellm` pattern |
| Add to `DEFAULT_AGENTS` + `seed-all.ts` | Single shared constants file | Dual registration is a maintenance trap |
| Full hermes profile | Create profile + document Max exception | Max doesn't have a profile dir — document this edge case |

## Risks & Open Questions

1. **Sure dashboard login wall**: If Dipta wants Sure data specifically (not just financial market data), a proper integration requires: (a) Sure exposing an API, (b) sharing credentials via env var, or (c) using browser automation (hermes browser tools) on-demand rather than server-side scraping
2. **Financial API selection**: Which APIs to use depends on what the Sure dashboard actually tracks (crypto? stocks? personal expenses?). Need Dipta to confirm data sources.
3. **Nickname**: Planner chose "Coq" 🐓 but user said "something just like the other bots" — should confirm.
4. **Max profile exception**: Max runs off `~/.hermes/` root without a `~/.hermes/profiles/max/` subdirectory. This is confirmed and needs documentation.

## Final Plan

### Phase 1: Profile Setup

1. Create `~/.hermes/profiles/coq/` directory with:
   - `SOUL.md` — Finance Advisor persona
   - `config.yaml` — model configuration (follow sage/nova pattern)
   - `state.db` — initialize from existing profile template
2. Document the Max exception: Max is the only agent without a `~/.hermes/profiles/<id>/` directory

### Phase 2: Agent Registration (single source of truth)

3. Create `src/lib/agent-registry.ts` with a shared `AGENTS` constant:
   ```ts
   export const AGENTS = [
     { id: 'max', name: 'Max', emoji: '🐺', role: 'Chief of Staff / Orchestrator' },
     { id: 'sage', name: 'Sage', emoji: '🌿', role: 'AI Research Analyst' },
     { id: 'knox', name: 'Knox', emoji: '🔐', role: 'Security & Infrastructure Engineer' },
     { id: 'nova', name: 'Nova', emoji: '⭐', role: 'UI/UX & Frontend Review Agent' },
     { id: 'pixel', name: 'Pixel', emoji: '🎨', role: 'Repo Hygiene & Visual Polish Agent' },
     { id: 'coq', name: 'Coq', emoji: '🐓', role: 'Finance Advisor' },
   ] as const;
   ```
4. Update `src/app/api/agents/route.ts` to import from `AGENTS`
5. Update `prisma/seed-all.ts` to import from `AGENTS`
6. Run `npx tsx prisma/seed-all.ts` to seed Coq into Prisma

### Phase 3: API Route

7. Create `src/app/api/coq/route.ts`:
   - Use `fetchUrlContent` from `@/lib/fetch-url-content` pattern for web access
   - OR use direct API calls to financial data sources (Binance/Hyperliquid/CoinGecko)
   - Return structured finance data: `{ categories: [], spending: [], budget: [], days: [] }`
   - Graceful empty-state on failure
   - `export const revalidate = 3600` for hourly caching

### Phase 4: Dashboard Page

8. Create `src/app/coq/page.tsx` — dedicated Finance Advisor page
   - Follow the pattern of `/hermes`, `/freellm`, `/omniroute` pages
   - Include: spending overview, budget tracker, category breakdown
   - Use existing components: `MetricCard`, `Sparkline`, `Panel`
   - Client component with `useEffect` + polling

### Phase 5: Type Updates

9. Update `src/types/home-dashboard.ts`:
   - Add `CoqFinanceData` interface
   - Add to `HomeData` if needed (for home page summary cards)

### Phase 6: Kanban Task

10. Create kanban task (operator action):
    ```
    hermes kanban create "Daily Finance: Fetch market data and update spending tracker" --assignee coq
    ```

### Phase 7: Verification

11. `curl http://localhost:3000/api/coq` — confirm output
12. `npx tsc --noEmit` — verify no new TS errors
13. Verify `/coq` page renders
14. Verify `/api/agents` includes Coq

## Design Decisions (from Architect+Critic debate)

1. **No scraping**: The Sure dashboard has a login wall (302 → `/sessions/new`) and CSRF protection. Server-side scraping is infeasible. Financial data should come from proper APIs.
2. **Separate page, not home panel**: page.tsx is already 2128 lines. Adding Coq as a home panel would bloat it further. A dedicated `/coq` page follows the existing pattern of `/hermes`, `/freellm`, `/omniroute`.
3. **Single source of truth for agents**: The dual-registration in `DEFAULT_AGENTS` and `seed-all.ts` is a known maintenance trap. Extracting to a shared module fixes this.
4. **Coq profile follows the sage/knox/nova/pixel pattern**: Create `~/.hermes/profiles/coq/` — not the Max anomaly.
5. **Nickname is "Coq" 🐓**: Chosen by planner; a rooster that crows about money. Fun and distinct from existing agents.

## Files to Create/Modify

| File | Action |
|------|--------|
| `~/.hermes/profiles/coq/SOUL.md` | CREATE |
| `~/.hermes/profiles/coq/config.yaml` | CREATE |
| `~/.hermes/profiles/coq/state.db` | CREATE (copy template) |
| `src/lib/agent-registry.ts` | CREATE |
| `src/app/api/agents/route.ts` | MODIFY |
| `prisma/seed-all.ts` | MODIFY |
| `src/app/api/coq/route.ts` | CREATE |
| `src/app/coq/page.tsx` | CREATE |
| `src/types/home-dashboard.ts` | MODIFY |
