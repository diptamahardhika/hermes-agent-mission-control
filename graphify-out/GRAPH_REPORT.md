# Graph Report - hermes-agent-mission-control  (2026-09-22)

## Corpus Check
- 212 files · ~172,867 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1730 nodes · 2445 edges · 147 communities (105 shown, 34 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2cd0fcb6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- bridge.mjs
- app/page.tsx
- prisma.ts
- x-content/page.tsx
- agents/route.ts
- agents/page.tsx
- Phase 2.1 Verification Report
- README.md
- 🐘 Hermy HQ Self-Hosted PostgreSQL Migration Guide
- HermesBriefing Decision Layer - Phase 2 Plan
- decision-dashboard-widget.tsx
- articles/page.tsx
- Phase 2.2 Implementation Summary
- hermes/page.tsx
- package.json
- ai-news/route.ts
- fetchUrlContent
- kit.tsx
- Phase 2.1 Implementation Summary
- agent-proposals-widget.tsx
- memory-wiki/page.tsx
- client-pulse/route.ts
- Daily UI/UX Review: hermy-hq Pages
- react
- dependencies
- compilerOptions
- outlier-scanner.js
- home/route.ts
- tauri.conf.json
- content-os/page.tsx
- timeAgo
- github-review.ts
- Final Plan
- Ralplan: Comment Response & System Improvements
- OutlierFeed.tsx
- hermes-briefing.tsx
- x-analytics/page.tsx
- homelab/page.tsx
- LongFormPage
- hermes-bridge/package.json
- devDependencies
- api/ideas/route.ts
- findings/route.ts
- api/tasks/route.ts
- YouTubePage
- smoke-test.mjs
- homelab/route.ts
- scripts
- ideas/page.tsx
- allowScripts
- next-auth
- agent-chat/route.ts
- pr-opened/route.ts
- github/route.ts
- decisions/[id]/route.ts
- request/route.ts
- x-content/route.ts
- Docker Deployment
- watchdog.mjs
- sentry-test/page.tsx
- hermes-agent-mission-control
- freellm/route.ts
- trends/route.ts
- github/page.tsx
- metric-card.tsx
- Memory Wiki
- articles/route.ts
- scrape-metrics/route.ts
- generate-visual/route.ts
- Dashboard
- readme-validator.ts
- default.json
- The Approval Gate Is Non-Negotiable
- agent-bus/route.ts
- revise/route.ts
- saved-titles/route.ts
- crons/route.ts
- longform/generate/route.ts
- longform/route.ts
- score/route.ts
- x-content/tweak/route.ts
- visual/route.ts
- youtube/generate/route.ts
- performance/route.ts
- scripts/route.ts
- hermes-agent-mission-control
- overrides
- home-dashboard.ts
- garden/route.ts
- decisions/route.ts
- format/route.ts
- Plan: Address Deferred Items from ralplan-comment-response
- x-analytics/route.ts
- viral-score/route.ts
- ideas/generate/route.ts
- Ralplan: Tier 2 Structural Improvements — Consensus Plan
- command-palette.tsx
- test-phase2.sh
- graft
- map-chat/route.ts
- toast-context.tsx
- diagnostics/route.ts
- retry/route.ts
- longform/tweak/route.ts
- Panel
- Ralplan: hermy-hq Dashboard Improvement Priorities
- top-tweets/route.ts
- youtube-scrape/route.ts
- breadcrumbs.tsx
- donut-chart.tsx
- google-creds.ts
- middleware.ts
- vercel.json
- verify_github_panel.py
- setup.sh
- update-env.sh
- orchestrator_append.md
- postcss.config.mjs
- snipe/route.ts
- app
- feedback/route.ts
- calendar/route.ts
- Critic Review: Tier 2 Structural Improvements
- Ralplan: Tier 2 Structural Improvements — Prioritized Plan
- Architectural Review: Tier 2 Structural Improvements
- watchlist-radar/route.ts
- trends/update/route.ts
- coq/route.ts
- github-home-card.tsx
- CSS Custom Properties in Inline Styles
- tasks/page.tsx
- Ralplan Update: Tier 0C Fixed + Next Steps
- client-pulse/page.tsx
- next.config.ts
- youtube/ideas/route.ts
- HomelabStatusBadge
- homelab-home-card.tsx
- lucide-react
- HLPnlChart.tsx

## God Nodes (most connected - your core abstractions)
1. `prisma` - 51 edges
2. `react` - 44 edges
3. `lucide-react` - 28 edges
4. `runRequest()` - 18 edges
5. `Panel()` - 17 edges
6. `log()` - 16 edges
7. `EmptyState()` - 16 edges
8. `compilerOptions` - 16 edges
9. `q()` - 15 edges
10. `mirrorTick()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `fetchUrlContent()`  [EXTRACTED]
  src/app/api/articles/generate-article/route.ts → src/lib/fetch-url-content.ts
- `POST()` --calls--> `fetchUrlContent()`  [EXTRACTED]
  src/app/api/articles/generate-titles/route.ts → src/lib/fetch-url-content.ts
- `POST()` --calls--> `sh()`  [EXTRACTED]
  src/app/api/hermes/tasks/unblock/route.ts → src/lib/kanban-db.ts
- `ArticlesPageContent()` --calls--> `rise()`  [EXTRACTED]
  src/app/articles/page.tsx → src/components/ui/kit.tsx
- `DispatchBar()` --calls--> `useToast()`  [EXTRACTED]
  src/app/hermes/page.tsx → src/components/ui/toast/toast-context.tsx

## Import Cycles
- None detected.

## Communities (147 total, 34 thin omitted)

### Community 0 - "bridge.mjs"
Cohesion: 0.10
Nodes (52): bridgeDecisionsFromBrief(), bridgeStructuredDecision(), briefPrompt(), cachedInfCfg, cleanStaleLocks(), currentInferenceProvider(), __dirname, driftHealedAt (+44 more)

### Community 1 - "app/page.tsx"
Cohesion: 0.05
Nodes (30): BoardIdea, BuildIdea, CATEGORY_COLOR, CATEGORY_LABEL, Draft, FREELLM_TOK_COLORS, GH_LEVEL_COLORS, GitHubActivity (+22 more)

### Community 2 - "prisma.ts"
Cohesion: 0.06
Nodes (10): dynamic, dynamic, maxDuration, maxDuration, DaySnap, dynamic, dynamic, dynamic (+2 more)

### Community 3 - "x-content/page.tsx"
Cohesion: 0.08
Nodes (28): Signal, SignalCard(), timeAgo(), WatchlistData, WatchlistRadarPage(), Draft, DraftCard, DraftCardProps (+20 more)

### Community 4 - "agents/route.ts"
Cohesion: 0.06
Nodes (41): execSqlite(), JsonValue, main(), prisma, seedAgentStateFromKanban(), seedDatastore(), upsert(), epochToIso() (+33 more)

### Community 5 - "agents/page.tsx"
Cohesion: 0.06
Nodes (20): react-dom, Agent, AgentActivity, AgentCard(), AgentChat(), AgentProposal, AgentsPage(), roleColors (+12 more)

### Community 6 - "Phase 2.1 Verification Report"
Cohesion: 0.06
Nodes (35): Automated Tests: 18/19 Passed (94.7%), Backward Compatibility, Browser Testing Guide, Component Logic (Verified), Component Verification, Conclusion, Deployment, Deployment Checklist (+27 more)

### Community 7 - "README.md"
Cohesion: 0.06
Nodes (30): Config (env), Daily brief (scheduled kanban op), Hermes Bridge, Notes / assumptions, Setup (on the Mac mini), What it does, Hermy HQ — Agent Onboarding Prompt, Step 1 — Confirm prerequisites (+22 more)

### Community 8 - "🐘 Hermy HQ Self-Hosted PostgreSQL Migration Guide"
Cohesion: 0.06
Nodes (31): Accessing Remotely (Tailscale/SSH Tunnel), Backup failing, Connect via psql, Connection Pool Tuning, "Connection refused" on port 5432, Connection Strings for Hermy HQ, Daily Operations, For hermes-bridge (direct is fine - local only) (+23 more)

### Community 9 - "HermesBriefing Decision Layer - Phase 2 Plan"
Cohesion: 0.06
Nodes (31): 1. TypeScript Type Updates, 2. Component Updates, 3. Feature Flag System, 4. API Endpoints, Backend, Backward Compatibility, Changes Required, Current status & next (+23 more)

### Community 10 - "decision-dashboard-widget.tsx"
Cohesion: 0.23
Nodes (13): DecisionFilters, DecisionDashboardWidget(), DecisionDashboardWidgetProps, timeAgo(), DecisionDetailModal(), BadgeDef, KIND_BADGE, STATUS_BADGE (+5 more)

### Community 11 - "articles/page.tsx"
Cohesion: 0.11
Nodes (11): Article, CalendarTabProps, ChatMessage, ComposeTabProps, LibraryTabProps, SavedTitle, STATUS_COLUMNS, Tab (+3 more)

### Community 12 - "Phase 2.2 Implementation Summary"
Cohesion: 0.06
Nodes (31): 1. Database Schema (`prisma/schema.prisma`), 2. Backend Endpoints, 3. Action Handlers, 4. Activity Tracking, Activity Feed, Backward Compatibility, Changes Made, Conclusion (+23 more)

### Community 13 - "hermes/page.tsx"
Cohesion: 0.05
Nodes (51): ActivityFeed(), COLUMN_LABEL, COLUMN_ORDER, columnFor(), columnTone(), CronJob, CronPanel(), Ev (+43 more)

### Community 14 - "package.json"
Cohesion: 0.07
Nodes (27): pg, name, private, version, @auth/prisma-adapter, better-sqlite3, drizzle-orm, eslint (+19 more)

### Community 15 - "ai-news/route.ts"
Cohesion: 0.13
Nodes (23): decodeEntities(), deriveTags(), dynamic, fetchHN(), fetchNews(), GET(), ModelCard, NEWS_FEEDS (+15 more)

### Community 16 - "fetchUrlContent"
Cohesion: 0.12
Nodes (23): dynamic, maxDuration, POST(), TRACK_FORMULAS, dynamic, maxDuration, POST(), TRACK_DESCRIPTIONS (+15 more)

### Community 17 - "kit.tsx"
Cohesion: 0.16
Nodes (12): EMPTY_FORM, GardenBlob, Plant, LongformScript, TONE, Idea, LongformTab, OutlierFeed (+4 more)

### Community 18 - "Phase 2.1 Implementation Summary"
Cohesion: 0.08
Nodes (24): 1. TypeScript Types (`src/components/hermes-briefing.tsx`), 2. Feature Flag System (`src/lib/features.ts`), 3. Component Updates (`src/components/hermes-briefing.tsx`), 4. Backend Endpoint (`src/app/api/hermes/decisions/[id]/route.ts`), Backward Compatibility, Changes Made, Deployment Notes, Documentation (+16 more)

### Community 19 - "agent-proposals-widget.tsx"
Cohesion: 0.18
Nodes (9): AgentProposalsWidget(), FilterMode, Proposal, SortMode, InboxCard(), Req, timeAgo(), Eyebrow() (+1 more)

### Community 20 - "memory-wiki/page.tsx"
Cohesion: 0.13
Nodes (19): ConfidenceDot(), confidenceMeta(), confidenceValue(), Draft, draftFrom(), emptyDraft(), Entry, EntryCard() (+11 more)

### Community 21 - "client-pulse/route.ts"
Cohesion: 0.67
Nodes (3): AnalysisWithClient, asStringArray(), GET()

### Community 22 - "Daily UI/UX Review: hermy-hq Pages"
Cohesion: 0.10
Nodes (20): 1. DecisionDashboardWidget Action Buttons - MISSING FOCUS VISIBILITY ⭐ HIGH IMPACT, 2. Agent Proposals Widget Badge Styling - INCONSISTENT VISUAL LANGUAGE ⭐ MEDIUM IMPACT, 3. Decision Filtering - INCOMPLETE FOCUS SUPPORT ⭐ MEDIUM IMPACT, 4. MetricCard Focus Consistency - MINOR VISUAL INCONSISTENCY ⭐ LOW IMPACT, 5. Brand Voice Alignment - NOT APPLICABLE ⭐ LOW IMPACT, Accessibility ✅, 🚨 CRITICAL ISSUES FIXED, Daily UI/UX Review: hermy-hq Pages (+12 more)

### Community 23 - "react"
Cohesion: 0.33
Nodes (6): react, ConditionalLayout(), Logo(), mobileTabsRaw, navGroups, Sidebar()

### Community 24 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, @auth/prisma-adapter, better-sqlite3, drizzle-orm, formidable, googleapis, grammy, lucide-react (+13 more)

### Community 25 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 26 - "outlier-scanner.js"
Cohesion: 0.22
Nodes (16): API_KEYS, fetchJSON(), formatDuration(), fs, getApiKey(), getChannelInfo(), getChannelMedianViews(), getVideoDetails() (+8 more)

### Community 27 - "home/route.ts"
Cohesion: 0.06
Nodes (50): main(), prisma, upsert(), main(), prisma, readJson(), safeDate(), seedAgentState() (+42 more)

### Community 28 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 29 - "content-os/page.tsx"
Cohesion: 0.20
Nodes (14): bestViews(), ColKey, COLS, ContentOSPage(), Draft, fmt(), isTweet(), PipelineCard() (+6 more)

### Community 30 - "timeAgo"
Cohesion: 0.17
Nodes (16): CryptoPortfolioCard(), fmt(), fmtExact(), FreeLLMShareBars(), FreeLLMSpendPanel(), OmniRoutePanel(), OmniShareBars(), renderWithLinks() (+8 more)

### Community 31 - "github-review.ts"
Cohesion: 0.20
Nodes (14): checkUnusedDeps(), DANGEROUS_PATTERNS, DEBUG_PATTERNS, getRepoPath(), performSecurityReview(), REPO_MAP, ReviewFinding, ReviewResult (+6 more)

### Community 32 - "Final Plan"
Cohesion: 0.13
Nodes (14): Consensus Status, Design Decisions (from Architect+Critic debate), Files to Create/Modify, Final Plan, Finance Advisor Bot — Consensus Implementation Plan, Phase 1: Profile Setup, Phase 2: Agent Registration (single source of truth), Phase 3: API Route (+6 more)

### Community 33 - "Ralplan: Comment Response & System Improvements"
Cohesion: 0.10
Nodes (20): 1. Fix False-Positive Health Reporting in self-heal, 2. Fix healStuckKanban() to not depend on hermes CLI, 3. Add kanban sync health check to bridge, 4. Improve launchd health verification, 5. Fix kanban dispatcher stuck workers, Bridge & Dashboard restarted, Consensus Status, Context (+12 more)

### Community 34 - "OutlierFeed.tsx"
Cohesion: 0.19
Nodes (14): analyzeTitlePatterns(), formatNumber(), MinScore, NICHE_COLORS, NicheCount, OutlierData, OutlierFeed(), scoreBadgeColor() (+6 more)

### Community 35 - "hermes-briefing.tsx"
Cohesion: 0.17
Nodes (13): Briefing, Decision, DecisionAction, DecisionActionTarget, DecisionItem, DecisionKind, HermesBriefing(), Section (+5 more)

### Community 36 - "x-analytics/page.tsx"
Cohesion: 0.24
Nodes (8): AnalyticsData, DAYS, fmt(), fmtDate(), HeatCell, Tweet, XAnalyticsPage(), SectionHeader()

### Community 37 - "homelab/page.tsx"
Cohesion: 0.17
Nodes (12): Container, EMPTY, fmtBytesPerSec(), fmtMB(), HistoryStats, HomelabData, HomelabPage(), ServerStatus (+4 more)

### Community 38 - "LongFormPage"
Cohesion: 0.26
Nodes (13): LongFormPage(), approveAndGenerate(), copySpokenText(), PostedCard(), saveTw(), saveYt(), scrapeAndUpdate(), PostModal() (+5 more)

### Community 39 - "hermes-bridge/package.json"
Cohesion: 0.15
Nodes (12): bin, hermes-bridge, dependencies, pg, description, pg, name, private (+4 more)

### Community 40 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @tauri-apps/cli, tsx, @types/node (+4 more)

### Community 41 - "api/ideas/route.ts"
Cohesion: 0.21
Nodes (9): AGENT_PROFILES, DispatchInfo, DispatchState, dynamic, enrichWithDispatch(), GET(), POST(), requestKey() (+1 more)

### Community 42 - "findings/route.ts"
Cohesion: 0.29
Nodes (10): ensureFindingsDir(), FINDINGS_DIR, GET(), getReviewHistory(), listFindings(), PixelFinding, POST(), ReviewSummary (+2 more)

### Community 43 - "api/tasks/route.ts"
Cohesion: 0.35
Nodes (11): DELETE(), GET(), parseFrontmatter(), PATCH(), POST(), safeFileName(), serializeFrontmatter(), TaskData (+3 more)

### Community 44 - "YouTubePage"
Cohesion: 0.24
Nodes (7): funnelTone(), YouTubePage(), deleteScript(), rejectIdea(), RejectModal(), ScriptCard(), updateScript()

### Community 45 - "smoke-test.mjs"
Cohesion: 0.18
Nodes (9): checks, __dirname, execFileP, existingSet, optionalTables, pool, NOTE: pg returns jsonb columns as parsed JS objects, not strings., requiredTables (+1 more)

### Community 46 - "homelab/route.ts"
Cohesion: 0.20
Nodes (10): Container, dynamic, GET(), HistoryStats, revalidate, ServerStatus, ServiceStatus, summarize() (+2 more)

### Community 47 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, db:migrate, db:push, db:seed, db:studio, dev, lint (+2 more)

### Community 48 - "ideas/page.tsx"
Cohesion: 0.13
Nodes (12): ArticlesPageContent(), GardenPage(), AGENTS, CATEGORY_CONFIG, DispatchInfo, formatDate(), Idea, IdeaCard() (+4 more)

### Community 49 - "allowScripts"
Cohesion: 0.22
Nodes (9): allowScripts, better-sqlite3@12.11.1, esbuild@0.28.2, fsevents@2.3.3, prisma@6.19.2, @prisma/client@6.19.2, @prisma/engines@6.19.2, sharp@0.34.5 (+1 more)

### Community 50 - "next-auth"
Cohesion: 0.28
Nodes (6): next-auth, handler, authOptions, TODO: Add PrismaAdapter once DB-backed sessions are needed., next-auth, Session

### Community 51 - "agent-chat/route.ts"
Cohesion: 0.39
Nodes (8): AgentChatRequest, AgentId, AGENTS, execFileP, firstReplyAfter(), lastAssistantId(), POST(), profileHome()

### Community 52 - "pr-opened/route.ts"
Cohesion: 0.36
Nodes (7): dynamic, enqueuePixelMergeReview(), enqueuePixelReview(), execFileP, POST(), revalidate, verifySignature()

### Community 53 - "github/route.ts"
Cohesion: 0.28
Nodes (8): ActivitySummary, avatarUrl(), dynamic, GET(), headers(), Profile, Repo, revalidate

### Community 54 - "decisions/[id]/route.ts"
Cohesion: 0.39
Nodes (7): approveDecision(), archiveDecision(), dismissDecision(), handleDecisionAction(), PATCH(), pinDecision(), resolveDecision()

### Community 56 - "x-content/route.ts"
Cohesion: 0.36
Nodes (7): bestViews(), draftToApi(), dynamic, GET(), mergeMetrics(), PATCH(), POST()

### Community 57 - "Docker Deployment"
Cohesion: 0.25
Nodes (7): Access the Dashboard, Development with Hot Reload, Docker Deployment, Environment Variables, Health Check, Quick Start, Stop and Remove

### Community 58 - "watchdog.mjs"
Cohesion: 0.36
Nodes (7): BRIDGE_DIR, checkLaunchd(), isBridgeRunningFallback(), log(), LOG_FILE, main(), PID_FILE

### Community 59 - "sentry-test/page.tsx"
Cohesion: 0.10
Nodes (8): @sentry/nextjs, GET, ErrorBoundaryTest(), testApiError(), ErrorBoundary, createErrorResponse(), sanitizeErrorMessage(), withErrorLogging()

### Community 60 - "hermes-agent-mission-control"
Cohesion: 0.25
Nodes (7): Agent Commitments, Graft — repo context graph, graphify, hermes-agent-mission-control, Operator mandates, Ops facts, This is NOT the Next.js you know

### Community 61 - "freellm/route.ts"
Cohesion: 0.38
Nodes (6): authFetch(), dynamic, FREELLM_BASE, GET(), getSessionToken(), revalidate

### Community 62 - "trends/route.ts"
Cohesion: 0.33
Nodes (6): dynamic, GET(), readTrendData(), revalidate, Trend, TrendsResponse

### Community 63 - "github/page.tsx"
Cohesion: 0.25
Nodes (10): ActivitySummary, EMPTY, fmt(), GitHubData, GitHubPage(), GitHubProfile, langBadge(), Repo (+2 more)

### Community 64 - "metric-card.tsx"
Cohesion: 0.38
Nodes (5): Sparkline(), SparklineProps, MetricCard(), MetricCardProps, useCountUp()

### Community 65 - "Memory Wiki"
Cohesion: 0.33
Nodes (5): Entry format (one markdown file per entry, YAML frontmatter + body), Hygiene, Memory Wiki, Retrieval (before answering), When to write to the wiki (not MEMORY.md)

### Community 67 - "scrape-metrics/route.ts"
Cohesion: 0.47
Nodes (5): dynamic, getTwitterMetrics(), getYouTubeMetrics(), maxDuration, POST()

### Community 68 - "generate-visual/route.ts"
Cohesion: 0.53
Nodes (5): ACCENT_COLORS, esc(), POST(), stripBullet(), wrapText()

### Community 69 - "Dashboard"
Cohesion: 0.33
Nodes (7): Dashboard(), EMPTY, fmtThb(), greeting(), sampleSeries(), snapDelta(), withDevPreview()

### Community 70 - "readme-validator.ts"
Cohesion: 0.47
Nodes (5): ExampleResult, extractCodeExamples(), ReadmeValidationResult, validateExample(), validateReadmeExamples()

### Community 71 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 72 - "The Approval Gate Is Non-Negotiable"
Cohesion: 0.33
Nodes (5): Anti-patterns to catch myself on:, Concrete rules:, The Approval Gate Is Non-Negotiable, Why this matters:, Workflow Discipline — Self-Enforcement

### Community 74 - "revise/route.ts"
Cohesion: 0.50
Nodes (4): braveSearch(), dynamic, maxDuration, POST()

### Community 76 - "crons/route.ts"
Cohesion: 0.50
Nodes (3): CronJob, GET(), parseCrons()

### Community 77 - "longform/generate/route.ts"
Cohesion: 0.60
Nodes (4): braveSearch(), callLLM(), maxDuration, POST()

### Community 79 - "score/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, GET(), revalidate, weeklyGithubContributions()

### Community 80 - "x-content/tweak/route.ts"
Cohesion: 0.40
Nodes (3): dynamic, TODO: This path won't exist on Vercel — consider bundling voice-rules or…, VOICE_RULES

### Community 82 - "youtube/generate/route.ts"
Cohesion: 0.70
Nodes (4): braveSearch(), callOpenAI(), fetchArticle(), POST()

### Community 83 - "performance/route.ts"
Cohesion: 0.60
Nodes (4): dynamic, GET(), getAllVideos(), parseIsoDuration()

### Community 85 - "hermes-agent-mission-control"
Cohesion: 0.50
Nodes (3): hermes-agent-mission-control, Operator mandates, Ops facts

### Community 86 - "overrides"
Cohesion: 0.50
Nodes (4): overrides, @babel/core, brace-expansion, deepmerge-ts

### Community 87 - "home-dashboard.ts"
Cohesion: 0.21
Nodes (13): HomeData, BaseByModel, CoqFinanceData, FreeLLMByModel, FreeLLMData, GitHubHomeData, HomelabHomeData, HomelabSystem (+5 more)

### Community 90 - "format/route.ts"
Cohesion: 0.67
Nodes (3): extractJson(), FormattedTask, POST()

### Community 91 - "Plan: Address Deferred Items from ralplan-comment-response"
Cohesion: 0.14
Nodes (12): Architecture / Proposed Approach, Current Context / Assumptions, Goal, Open Questions, Per-task TDD cycle:, Plan: Address Deferred Items from ralplan-comment-response, Risks, Tradeoffs, and Open Questions, Step-by-step Tasks (+4 more)

### Community 92 - "x-analytics/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, extractMetrics(), GET()

### Community 93 - "viral-score/route.ts"
Cohesion: 0.67
Nodes (3): analyzeContent(), dynamic, POST()

### Community 94 - "ideas/generate/route.ts"
Cohesion: 0.83
Nodes (3): braveSearch(), callOpenAI(), POST()

### Community 95 - "Ralplan: Tier 2 Structural Improvements — Consensus Plan"
Cohesion: 0.13
Nodes (14): 1. The Real Problem Isn't File Size, 2. Per-Panel Skeletons Solve Two Problems, 3. Simplified Loading State Approach, Consensus Status, Final Prioritized Plan, Implementation Notes, Key Insights from Reviews, Next Step (+6 more)

### Community 96 - "command-palette.tsx"
Cohesion: 0.29
Nodes (6): DispatchBar(), CommandPalette(), NAV, NavItem, Row, useToast()

### Community 100 - "toast-context.tsx"
Cohesion: 0.12
Nodes (11): geist, geistMono, metadata, viewport, Toast, ToastContext, ToastContextValue, ToastProvider() (+3 more)

### Community 104 - "Panel"
Cohesion: 0.22
Nodes (8): Props, State, ago(), HermesDispatches(), LABEL, Req, TONE, Panel()

### Community 105 - "Ralplan: hermy-hq Dashboard Improvement Priorities"
Cohesion: 0.14
Nodes (13): Consensus Status, Consensus: YES ✅, Dependency Map (Revised), Key Design Decisions, Ralplan: hermy-hq Dashboard Improvement Priorities, Revised Priority Plan, Risks and Open Questions, Round 1 Revision Summary (+5 more)

### Community 129 - "Critic Review: Tier 2 Structural Improvements"
Cohesion: 0.14
Nodes (13): Accessibility, Bundle Size (Minor), C1: P1 Effort Underestimated — Confirmed and Deepened, C2: Prioritization Is Correct — Challenge the Framing, C3: Missing Dimensions, C4: Simplicity Test — There's an Even Simpler Path, C5: Principle Test — Minimal Disruption, C6: The One Thing the Plan Gets Wrong (+5 more)

### Community 130 - "Ralplan: Tier 2 Structural Improvements — Prioritized Plan"
Cohesion: 0.17
Nodes (11): Final Verdicts, Foundational Facts, (META) Is "page.tsx is too big" the right problem?, Opportunity Cost, P1: Per-Panel Loading Skeletons ⭐ HIGH VALUE, LOW EFFORT, P2: Extract High-Cost Panels Reactively (when adding new ones), P3: Monitor Lint Rule Headroom, Ralplan: Tier 2 Structural Improvements — Prioritized Plan (+3 more)

### Community 131 - "Architectural Review: Tier 2 Structural Improvements"
Cohesion: 0.20
Nodes (9): 1. Prioritization — Sound ✓, 2. Hidden Risks — One Not Addressed, 3. Loading Skeleton Approach — Correct Abstraction ✓, 4. Extraction Timing — Wait is Correct ✓, 5. Recommendations, Architectural Review: Tier 2 Structural Improvements, Per-panel loading state adds state machinery to 19 panels, Summary (+1 more)

### Community 135 - "coq/route.ts"
Cohesion: 0.31
Nodes (8): DATA_PATH, dynamic, emptyState(), FinanceCategory, FinanceData, GET(), readFinanceData(), revalidate

### Community 136 - "github-home-card.tsx"
Cohesion: 0.22
Nodes (6): GitHubActivity, GitHubContribDay, GitHubContributions, GitHubHomeCard(), GitHubProfile, GitHubRepo

### Community 137 - "CSS Custom Properties in Inline Styles"
Cohesion: 0.29
Nodes (6): CSS Custom Properties in Inline Styles, Fix Pattern, Stale Cache Trap, The Pattern, Verification Loop, Why `:root`, Not `@theme inline`

### Community 138 - "tasks/page.tsx"
Cohesion: 0.20
Nodes (15): columns, STATUS_COLORS, statusColor(), Task, TaskCard(), TaskDraft, TaskEditor(), TasksPage() (+7 more)

### Community 139 - "Ralplan Update: Tier 0C Fixed + Next Steps"
Cohesion: 0.33
Nodes (5): Next Step: Tier 2 — Structural Improvements, Pending Work, Ralplan Update: Tier 0C Fixed + Next Steps, Tier 0C — ESLint line cap (NOW WORKING ✅), What Changed

### Community 140 - "client-pulse/page.tsx"
Cohesion: 0.32
Nodes (7): categoryLabel, categoryTone, ClientPulsePage(), dateLabel(), PulseClient, PulseData, scoreColor()

### Community 141 - "next.config.ts"
Cohesion: 0.50
Nodes (3): nextConfig, sentryConfig, next

### Community 143 - "HomelabStatusBadge"
Cohesion: 0.50
Nodes (4): getHomelabBadgeStyle(), getHomelabDotColor(), getHomelabLabel(), HomelabStatusBadge()

### Community 144 - "homelab-home-card.tsx"
Cohesion: 0.50
Nodes (3): HomelabData, HomelabHomeCard(), timeAgo()

### Community 145 - "lucide-react"
Cohesion: 0.15
Nodes (8): lucide-react, AIModelNewsPanel(), AINewsData, ModelCard, DIAGNOSTIC_IDS_QUERY, DIAGNOSTIC_TASK_IDS, DiagnosticsResult, DiagnosticsStrip()

### Community 146 - "HLPnlChart.tsx"
Cohesion: 0.67
Nodes (3): ChartPoint, fmt(), HLPnlChart()

## Knowledge Gaps
- **768 isolated node(s):** `graft`, `__dirname`, `HOST`, `POLL_MS`, `MIRROR_MS` (+763 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 981 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `app/page.tsx`, `x-content/page.tsx`, `agents/page.tsx`, `github-home-card.tsx`, `decision-dashboard-widget.tsx`, `articles/page.tsx`, `client-pulse/page.tsx`, `hermes/page.tsx`, `package.json`, `tasks/page.tsx`, `homelab-home-card.tsx`, `lucide-react`, `kit.tsx`, `agent-proposals-widget.tsx`, `memory-wiki/page.tsx`, `HLPnlChart.tsx`, `content-os/page.tsx`, `OutlierFeed.tsx`, `hermes-briefing.tsx`, `x-analytics/page.tsx`, `homelab/page.tsx`, `ideas/page.tsx`, `sentry-test/page.tsx`, `github/page.tsx`, `metric-card.tsx`, `command-palette.tsx`, `toast-context.tsx`, `Panel`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `@prisma/client` connect `home/route.ts` to `prisma.ts`, `agents/route.ts`, `client-pulse/route.ts`, `package.json`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `lucide-react` to `app/page.tsx`, `agents/page.tsx`, `github-home-card.tsx`, `decision-dashboard-widget.tsx`, `tasks/page.tsx`, `hermes/page.tsx`, `package.json`, `homelab-home-card.tsx`, `kit.tsx`, `agent-proposals-widget.tsx`, `memory-wiki/page.tsx`, `react`, `content-os/page.tsx`, `hermes-briefing.tsx`, `homelab/page.tsx`, `ideas/page.tsx`, `github/page.tsx`, `metric-card.tsx`, `command-palette.tsx`, `toast-context.tsx`, `Panel`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `runRequest()` (e.g. with `log()` and `q()`) actually correct?**
  _`runRequest()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `graft`, `__dirname`, `HOST` to the rest of the system?**
  _768 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `bridge.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09935064935064936 - nodes in this community are weakly interconnected._
- **Should `app/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05398110661268556 - nodes in this community are weakly interconnected._