# Graph Report - hermes-agent-mission-control  (2026-09-04)

## Corpus Check
- 171 files · ~149,970 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1468 nodes · 1987 edges · 132 communities (85 shown, 39 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9de382ee`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- devDependencies
- bridge.mjs
- app/page.tsx
- x-content/page.tsx
- dependencies
- prisma.ts
- agents/page.tsx
- compilerOptions
- hermes/page.tsx
- src components hermes runs
- src app api ai news route
- src app api articles generate artic
- Phase 2.1 Verification Report
- tauri.conf.json
- memory-wiki/page.tsx
- home/route.ts
- agent-proposals-widget.tsx
- outlier-scanner.js
- articles/page.tsx
- kit.tsx
- ideas/page.tsx
- content-os/page.tsx
- github-review.ts
- agents/route.ts
- tasks/page.tsx
- src components outlierfeed
- seed.ts
- homelab/page.tsx
- LongFormPage
- hermes-bridge/package.json
- api/ideas/route.ts
- findings/route.ts
- api/tasks/route.ts
- fmt
- YouTubePage
- smoke-test.mjs
- homelab/route.ts
- github/page.tsx
- watchdog.mjs
- agent-proposals/route.ts
- agent-chat/route.ts
- github/route.ts
- sage-findings/route.ts
- x-content/route.ts
- client-pulse/page.tsx
- seed-all.ts
- default.json
- pr-opened/route.ts
- freellm/route.ts
- trends/route.ts
- timeAgo
- src components sparkline
- articles/route.ts
- scrape-metrics/route.ts
- generate-visual/route.ts
- request/route.ts
- Dashboard
- hermes-dispatches.tsx
- readme-validator.ts
- agent-bus/route.ts
- revise/route.ts
- saved-titles/route.ts
- [...nextauth]/route.ts
- clear/route.ts
- crons/route.ts
- longform/generate/route.ts
- longform/route.ts
- score/route.ts
- x-content/tweak/route.ts
- visual/route.ts
- youtube/generate/route.ts
- performance/route.ts
- scripts/route.ts
- seed-datastore.ts
- vercel.json
- generate-visuals/route.ts
- README.md
- garden/route.ts
- format/route.ts
- watchlist-radar/route.ts
- src app api x analytics route
- src app api x content feedback rout
- src app api x content viral score r
- src app api youtube ideas generate 
- src app api youtube ideas route
- src components hlpnlchart
- HermesBriefing Decision Layer - Phase 2 Plan
- 🐘 Hermy HQ Self-Hosted PostgreSQL Migration Guide
- diagnostics/route.ts
- retry/route.ts
- unblock/route.ts
- longform/tweak/route.ts
- Phase 2.2 Implementation Summary
- trends/update/route.ts
- mark-posted/route.ts
- top-tweets/route.ts
- Phase 2.1 Implementation Summary
- youtube-scrape/route.ts
- breadcrumbs.tsx
- donut-chart.tsx
- google-creds.ts
- middleware.ts
- next-auth.d.ts
- eslint.config.mjs
- setup.sh
- update-env.sh
- next.config.ts
- postcss.config.mjs
- ScoreGauge
- app
- hermes-briefing.tsx
- 02-performance.sql
- 03-monitoring.sql
- decisions/[id]/route.ts
- hermes-agent-mission-control
- Memory Wiki
- The Approval Gate Is Non-Negotiable
- hermes-agent-mission-control
- decisions/route.ts
- test-phase2.sh
- map-chat/route.ts
- x-stats/route.ts
- watchlist-radar/update/route.ts
- orchestrator_append.md

## God Nodes (most connected - your core abstractions)
1. `prisma` - 51 edges
2. `EmptyState()` - 16 edges
3. `compilerOptions` - 16 edges
4. `runRequest()` - 13 edges
5. `mirrorTick()` - 13 edges
6. `🐘 Hermy HQ Self-Hosted PostgreSQL Migration Guide` - 13 edges
7. `log()` - 12 edges
8. `YouTubePage()` - 12 edges
9. `Panel()` - 12 edges
10. `Pill()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `fetchUrlContent()`  [EXTRACTED]
  src/app/api/articles/generate-article/route.ts → src/lib/fetch-url-content.ts
- `POST()` --calls--> `fetchUrlContent()`  [EXTRACTED]
  src/app/api/articles/generate-titles/route.ts → src/lib/fetch-url-content.ts
- `ArticlesPageContent()` --calls--> `rise()`  [EXTRACTED]
  src/app/articles/page.tsx → src/components/ui/kit.tsx
- `DispatchBar()` --calls--> `useToast()`  [EXTRACTED]
  src/app/hermes/page.tsx → src/components/ui/toast/toast-context.tsx
- `IdeasPage()` --calls--> `rise()`  [EXTRACTED]
  src/app/ideas/page.tsx → src/components/ui/kit.tsx

## Import Cycles
- None detected.

## Communities (132 total, 39 thin omitted)

### Community 0 - "devDependencies"
Cohesion: 0.04
Nodes (48): eslint, eslint-config-next, allowScripts, better-sqlite3@12.11.1, esbuild@0.28.2, fsevents@2.3.3, prisma@6.19.2, @prisma/client@6.19.2 (+40 more)

### Community 1 - "bridge.mjs"
Cohesion: 0.13
Nodes (43): briefPrompt(), cachedInfCfg, cleanStaleLocks(), currentInferenceProvider(), __dirname, driftHealedAt, emit(), ensureTempKanbanDb() (+35 more)

### Community 2 - "app/page.tsx"
Cohesion: 0.05
Nodes (32): AINewsData, BoardIdea, BuildIdea, CATEGORY_COLOR, CATEGORY_LABEL, Draft, FREELLM_TOK_COLORS, FreeLLMData (+24 more)

### Community 3 - "x-content/page.tsx"
Cohesion: 0.07
Nodes (35): Signal, SignalCard(), timeAgo(), WatchlistData, WatchlistRadarPage(), AnalyticsData, DAYS, fmt() (+27 more)

### Community 4 - "dependencies"
Cohesion: 0.05
Nodes (39): @auth/prisma-adapter, better-sqlite3, drizzle-orm, formidable, googleapis, grammy, lucide-react, next (+31 more)

### Community 5 - "prisma.ts"
Cohesion: 0.06
Nodes (10): dynamic, AnalysisWithClient, asStringArray(), GET(), DaySnap, dynamic, dynamic, dynamic (+2 more)

### Community 6 - "agents/page.tsx"
Cohesion: 0.06
Nodes (19): Agent, AgentActivity, AgentCard(), AgentChat(), AgentProposal, AgentsPage(), roleColors, statusConfig (+11 more)

### Community 7 - "compilerOptions"
Cohesion: 0.06
Nodes (30): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+22 more)

### Community 8 - "hermes/page.tsx"
Cohesion: 0.05
Nodes (46): ActivityFeed(), COLUMN_LABEL, COLUMN_ORDER, columnFor(), columnTone(), CronJob, CronPanel(), DispatchBar() (+38 more)

### Community 9 - "src components hermes runs"
Cohesion: 0.10
Nodes (27): Cost, duration(), Filter, FILTERS, fmtTokens(), fmtUsd(), getJSON(), HermesRuns() (+19 more)

### Community 10 - "src app api ai news route"
Cohesion: 0.13
Nodes (23): decodeEntities(), deriveTags(), dynamic, fetchHN(), fetchNews(), GET(), ModelCard, NEWS_FEEDS (+15 more)

### Community 11 - "src app api articles generate artic"
Cohesion: 0.12
Nodes (23): dynamic, maxDuration, POST(), TRACK_FORMULAS, dynamic, maxDuration, POST(), TRACK_DESCRIPTIONS (+15 more)

### Community 12 - "Phase 2.1 Verification Report"
Cohesion: 0.06
Nodes (33): Automated Tests: 18/19 Passed (94.7%), Backward Compatibility, Browser Testing Guide, Component Logic (Verified), Component Verification, Conclusion, Deployment, Deployment Checklist (+25 more)

### Community 13 - "tauri.conf.json"
Cohesion: 0.09
Nodes (22): icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, icons/icon.ico, app, security, windows (+14 more)

### Community 14 - "memory-wiki/page.tsx"
Cohesion: 0.13
Nodes (19): ConfidenceDot(), confidenceMeta(), confidenceValue(), Draft, draftFrom(), emptyDraft(), Entry, EntryCard() (+11 more)

### Community 15 - "home/route.ts"
Cohesion: 0.13
Nodes (12): BN_CACHE, BoardIdeaRoute, dynamic, extractMetrics(), formatHermesKanban(), GET(), GH_CACHE, HERMES_KANBAN_DEMO_TASKS (+4 more)

### Community 16 - "agent-proposals-widget.tsx"
Cohesion: 0.18
Nodes (9): AgentProposalsWidget(), FilterMode, Proposal, SortMode, InboxCard(), Req, timeAgo(), Eyebrow() (+1 more)

### Community 17 - "outlier-scanner.js"
Cohesion: 0.22
Nodes (16): API_KEYS, fetchJSON(), formatDuration(), fs, getApiKey(), getChannelInfo(), getChannelMedianViews(), getVideoDetails() (+8 more)

### Community 18 - "articles/page.tsx"
Cohesion: 0.11
Nodes (11): Article, CalendarTabProps, ChatMessage, ComposeTabProps, LibraryTabProps, SavedTitle, STATUS_COLUMNS, Tab (+3 more)

### Community 19 - "kit.tsx"
Cohesion: 0.15
Nodes (13): EMPTY_FORM, GardenBlob, Plant, LongformScript, TONE, Idea, LongformTab, OutlierFeed (+5 more)

### Community 20 - "ideas/page.tsx"
Cohesion: 0.13
Nodes (12): ArticlesPageContent(), GardenPage(), AGENTS, CATEGORY_CONFIG, DispatchInfo, formatDate(), Idea, IdeaCard() (+4 more)

### Community 21 - "content-os/page.tsx"
Cohesion: 0.20
Nodes (14): bestViews(), ColKey, COLS, ContentOSPage(), Draft, fmt(), isTweet(), PipelineCard() (+6 more)

### Community 22 - "github-review.ts"
Cohesion: 0.20
Nodes (14): checkUnusedDeps(), DANGEROUS_PATTERNS, DEBUG_PATTERNS, getRepoPath(), performSecurityReview(), REPO_MAP, ReviewFinding, ReviewResult (+6 more)

### Community 23 - "agents/route.ts"
Cohesion: 0.18
Nodes (13): Activity, ACTIVITY_PROFILE_MAP, DEFAULT_AGENTS, dynamic, execFileP, GET(), hermesKanbanActivity(), hermesKanbanLive() (+5 more)

### Community 24 - "tasks/page.tsx"
Cohesion: 0.20
Nodes (15): columns, STATUS_COLORS, statusColor(), Task, TaskCard(), TaskDraft, TaskEditor(), TasksPage() (+7 more)

### Community 25 - "src components outlierfeed"
Cohesion: 0.19
Nodes (14): analyzeTitlePatterns(), formatNumber(), MinScore, NICHE_COLORS, NicheCount, OutlierData, OutlierFeed(), scoreBadgeColor() (+6 more)

### Community 26 - "seed.ts"
Cohesion: 0.41
Nodes (14): main(), prisma, readJson(), safeDate(), seedAgentState(), seedContentCalendar(), seedContentRequests(), seedDrafts() (+6 more)

### Community 27 - "homelab/page.tsx"
Cohesion: 0.17
Nodes (12): Container, EMPTY, fmtBytesPerSec(), fmtMB(), HistoryStats, HomelabData, HomelabPage(), ServerStatus (+4 more)

### Community 28 - "LongFormPage"
Cohesion: 0.26
Nodes (13): LongFormPage(), approveAndGenerate(), copySpokenText(), PostedCard(), saveTw(), saveYt(), scrapeAndUpdate(), PostModal() (+5 more)

### Community 29 - "hermes-bridge/package.json"
Cohesion: 0.15
Nodes (12): bin, hermes-bridge, dependencies, pg, description, pg, name, private (+4 more)

### Community 30 - "api/ideas/route.ts"
Cohesion: 0.21
Nodes (9): AGENT_PROFILES, DispatchInfo, DispatchState, dynamic, enrichWithDispatch(), GET(), POST(), requestKey() (+1 more)

### Community 31 - "findings/route.ts"
Cohesion: 0.29
Nodes (10): ensureFindingsDir(), FINDINGS_DIR, GET(), getReviewHistory(), listFindings(), PixelFinding, POST(), ReviewSummary (+2 more)

### Community 32 - "api/tasks/route.ts"
Cohesion: 0.35
Nodes (11): DELETE(), GET(), parseFrontmatter(), PATCH(), POST(), safeFileName(), serializeFrontmatter(), TaskData (+3 more)

### Community 33 - "fmt"
Cohesion: 0.21
Nodes (12): fmt(), fmtExact(), FreeLLMShareBars(), FreeLLMSpendPanel(), modelProvider(), ModelShareBars(), OmniRoutePanel(), OmniShareBars() (+4 more)

### Community 34 - "YouTubePage"
Cohesion: 0.24
Nodes (7): funnelTone(), YouTubePage(), deleteScript(), rejectIdea(), RejectModal(), ScriptCard(), updateScript()

### Community 35 - "smoke-test.mjs"
Cohesion: 0.18
Nodes (9): checks, __dirname, execFileP, existingSet, optionalTables, pool, NOTE: pg returns jsonb columns as parsed JS objects, not strings., requiredTables (+1 more)

### Community 36 - "homelab/route.ts"
Cohesion: 0.20
Nodes (10): Container, dynamic, GET(), HistoryStats, revalidate, ServerStatus, ServiceStatus, summarize() (+2 more)

### Community 37 - "github/page.tsx"
Cohesion: 0.25
Nodes (10): ActivitySummary, EMPTY, fmt(), GitHubData, GitHubPage(), GitHubProfile, langBadge(), Repo (+2 more)

### Community 38 - "watchdog.mjs"
Cohesion: 0.36
Nodes (7): BRIDGE_DIR, checkLaunchd(), isBridgeRunningFallback(), log(), LOG_FILE, main(), PID_FILE

### Community 39 - "agent-proposals/route.ts"
Cohesion: 0.44
Nodes (7): epochToIso(), execFileP, firstLine(), GET(), POST(), shJson(), toProposal()

### Community 40 - "agent-chat/route.ts"
Cohesion: 0.39
Nodes (8): AgentChatRequest, AgentId, AGENTS, execFileP, firstReplyAfter(), lastAssistantId(), POST(), profileHome()

### Community 41 - "github/route.ts"
Cohesion: 0.28
Nodes (8): ActivitySummary, avatarUrl(), dynamic, GET(), headers(), Profile, Repo, revalidate

### Community 42 - "sage-findings/route.ts"
Cohesion: 0.31
Nodes (8): categorize(), dynamic, execFileP, Finding, GET(), revalidate, SageCategory, sageFindings()

### Community 43 - "x-content/route.ts"
Cohesion: 0.36
Nodes (7): bestViews(), draftToApi(), dynamic, GET(), mergeMetrics(), PATCH(), POST()

### Community 44 - "client-pulse/page.tsx"
Cohesion: 0.32
Nodes (7): categoryLabel, categoryTone, ClientPulsePage(), dateLabel(), PulseClient, PulseData, scoreColor()

### Community 45 - "seed-all.ts"
Cohesion: 0.43
Nodes (7): execSqlite(), JsonValue, main(), prisma, seedAgentStateFromKanban(), seedDatastore(), upsert()

### Community 46 - "default.json"
Cohesion: 0.25
Nodes (7): core:default, main, description, identifier, permissions, $schema, windows

### Community 47 - "pr-opened/route.ts"
Cohesion: 0.36
Nodes (7): dynamic, enqueuePixelMergeReview(), enqueuePixelReview(), execFileP, POST(), revalidate, verifySignature()

### Community 48 - "freellm/route.ts"
Cohesion: 0.38
Nodes (6): authFetch(), dynamic, FREELLM_BASE, GET(), getSessionToken(), revalidate

### Community 49 - "trends/route.ts"
Cohesion: 0.33
Nodes (6): dynamic, GET(), readTrendData(), revalidate, Trend, TrendsResponse

### Community 50 - "timeAgo"
Cohesion: 0.29
Nodes (7): CryptoPortfolioCard(), HomelabHomeCard(), renderWithLinks(), SageFindingsPanel(), timeAgo(), YouTubeCard(), YouTubeVideoTabs()

### Community 51 - "src components sparkline"
Cohesion: 0.38
Nodes (5): Sparkline(), SparklineProps, MetricCard(), MetricCardProps, useCountUp()

### Community 53 - "scrape-metrics/route.ts"
Cohesion: 0.47
Nodes (5): dynamic, getTwitterMetrics(), getYouTubeMetrics(), maxDuration, POST()

### Community 54 - "generate-visual/route.ts"
Cohesion: 0.53
Nodes (5): ACCENT_COLORS, esc(), POST(), stripBullet(), wrapText()

### Community 56 - "Dashboard"
Cohesion: 0.40
Nodes (6): Dashboard(), EMPTY, greeting(), sampleSeries(), snapDelta(), withDevPreview()

### Community 57 - "hermes-dispatches.tsx"
Cohesion: 0.33
Nodes (6): ago(), HermesDispatches(), LABEL, Req, TONE, SectionHeader()

### Community 58 - "readme-validator.ts"
Cohesion: 0.47
Nodes (5): ExampleResult, extractCodeExamples(), ReadmeValidationResult, validateExample(), validateReadmeExamples()

### Community 60 - "revise/route.ts"
Cohesion: 0.50
Nodes (4): braveSearch(), dynamic, maxDuration, POST()

### Community 62 - "[...nextauth]/route.ts"
Cohesion: 0.50
Nodes (3): handler, authOptions, TODO: Add PrismaAdapter once DB-backed sessions are needed.

### Community 64 - "crons/route.ts"
Cohesion: 0.50
Nodes (3): CronJob, GET(), parseCrons()

### Community 65 - "longform/generate/route.ts"
Cohesion: 0.60
Nodes (4): braveSearch(), callLLM(), maxDuration, POST()

### Community 67 - "score/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, GET(), revalidate, weeklyGithubContributions()

### Community 68 - "x-content/tweak/route.ts"
Cohesion: 0.40
Nodes (3): dynamic, TODO: This path won't exist on Vercel — consider bundling voice-rules or…, VOICE_RULES

### Community 70 - "youtube/generate/route.ts"
Cohesion: 0.70
Nodes (4): braveSearch(), callOpenAI(), fetchArticle(), POST()

### Community 71 - "performance/route.ts"
Cohesion: 0.60
Nodes (4): dynamic, GET(), getAllVideos(), parseIsoDuration()

### Community 73 - "seed-datastore.ts"
Cohesion: 0.67
Nodes (3): main(), prisma, upsert()

### Community 74 - "vercel.json"
Cohesion: 0.50
Nodes (3): iad1, crons, regions

### Community 76 - "README.md"
Cohesion: 0.06
Nodes (30): Config (env), Daily brief (scheduled kanban op), Hermes Bridge, Notes / assumptions, Setup (on the Mac mini), What it does, Hermy HQ — Agent Onboarding Prompt, Step 1 — Confirm prerequisites (+22 more)

### Community 78 - "format/route.ts"
Cohesion: 0.67
Nodes (3): extractJson(), FormattedTask, POST()

### Community 80 - "src app api x analytics route"
Cohesion: 0.67
Nodes (3): dynamic, extractMetrics(), GET()

### Community 82 - "src app api x content viral score r"
Cohesion: 0.67
Nodes (3): analyzeContent(), dynamic, POST()

### Community 83 - "src app api youtube ideas generate "
Cohesion: 0.83
Nodes (3): braveSearch(), callOpenAI(), POST()

### Community 85 - "src components hlpnlchart"
Cohesion: 0.67
Nodes (3): ChartPoint, fmt(), HLPnlChart()

### Community 86 - "HermesBriefing Decision Layer - Phase 2 Plan"
Cohesion: 0.06
Nodes (31): 1. TypeScript Type Updates, 2. Component Updates, 3. Feature Flag System, 4. API Endpoints, Backend, Backward Compatibility, Changes Required, Dependencies (+23 more)

### Community 87 - "🐘 Hermy HQ Self-Hosted PostgreSQL Migration Guide"
Cohesion: 0.06
Nodes (31): Accessing Remotely (Tailscale/SSH Tunnel), Backup failing, Connect via psql, Connection Pool Tuning, "Connection refused" on port 5432, Connection Strings for Hermy HQ, Daily Operations, For hermes-bridge (direct is fine - local only) (+23 more)

### Community 92 - "Phase 2.2 Implementation Summary"
Cohesion: 0.06
Nodes (30): 1. Database Schema (`prisma/schema.prisma`), 2. Backend Endpoints, 3. Action Handlers, 4. Activity Tracking, Activity Feed, Backward Compatibility, Changes Made, Conclusion (+22 more)

### Community 96 - "Phase 2.1 Implementation Summary"
Cohesion: 0.09
Nodes (22): 1. TypeScript Types (`src/components/hermes-briefing.tsx`), 2. Feature Flag System (`src/lib/features.ts`), 3. Component Updates (`src/components/hermes-briefing.tsx`), 4. Backend Endpoint (`src/app/api/hermes/decisions/[id]/route.ts`), Backward Compatibility, Changes Made, Deployment Notes, Documentation (+14 more)

### Community 117 - "hermes-briefing.tsx"
Cohesion: 0.17
Nodes (13): Briefing, Decision, DecisionAction, DecisionActionTarget, DecisionItem, DecisionKind, HermesBriefing(), Section (+5 more)

### Community 118 - "02-performance.sql"
Cohesion: 0.17
Nodes (10): hermy.cache_hit_ratio(), hermy.index_usage(), hermy.long_running_queries(), hermy.table_bloat(), pg_class, pg_index, pg_namespace, pg_stat_activity (+2 more)

### Community 119 - "03-monitoring.sql"
Cohesion: 0.25
Nodes (10): hermy.active_locks, hermy.index_sizes, hermy.sequence_usage, hermy.table_sizes, pg_class, pg_index, pg_namespace, pg_stat_activity (+2 more)

### Community 120 - "decisions/[id]/route.ts"
Cohesion: 0.39
Nodes (7): approveDecision(), archiveDecision(), dismissDecision(), handleDecisionAction(), PATCH(), pinDecision(), resolveDecision()

### Community 121 - "hermes-agent-mission-control"
Cohesion: 0.33
Nodes (5): Agent Commitments, graphify, hermes-agent-mission-control, Operator mandates, Ops facts

### Community 122 - "Memory Wiki"
Cohesion: 0.33
Nodes (5): Entry format (one markdown file per entry, YAML frontmatter + body), Hygiene, Memory Wiki, Retrieval (before answering), When to write to the wiki (not MEMORY.md)

### Community 123 - "The Approval Gate Is Non-Negotiable"
Cohesion: 0.33
Nodes (5): Anti-patterns to catch myself on:, Concrete rules:, The Approval Gate Is Non-Negotiable, Why this matters:, Workflow Discipline — Self-Enforcement

### Community 124 - "hermes-agent-mission-control"
Cohesion: 0.50
Nodes (3): hermes-agent-mission-control, Operator mandates, Ops facts

## Knowledge Gaps
- **608 isolated node(s):** `eslintConfig`, `__dirname`, `HOST`, `POLL_MS`, `MIRROR_MS` (+603 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 798 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `x-stats/route.ts`, `watchlist-radar/update/route.ts`, `home/route.ts`, `agents/route.ts`, `api/ideas/route.ts`, `homelab/route.ts`, `agent-proposals/route.ts`, `x-content/route.ts`, `trends/route.ts`, `articles/route.ts`, `scrape-metrics/route.ts`, `generate-visual/route.ts`, `request/route.ts`, `agent-bus/route.ts`, `saved-titles/route.ts`, `crons/route.ts`, `longform/route.ts`, `score/route.ts`, `x-content/tweak/route.ts`, `visual/route.ts`, `scripts/route.ts`, `generate-visuals/route.ts`, `garden/route.ts`, `watchlist-radar/route.ts`, `src app api x analytics route`, `src app api x content feedback rout`, `src app api youtube ideas generate `, `src app api youtube ideas route`, `trends/update/route.ts`, `mark-posted/route.ts`, `decisions/[id]/route.ts`, `decisions/route.ts`, `map-chat/route.ts`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `Skeleton()` connect `kit.tsx` to `app/page.tsx`, `hermes/page.tsx`, `client-pulse/page.tsx`, `memory-wiki/page.tsx`, `articles/page.tsx`, `ideas/page.tsx`, `content-os/page.tsx`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `EmptyState()` connect `kit.tsx` to `x-content/page.tsx`, `hermes/page.tsx`, `src components hermes runs`, `client-pulse/page.tsx`, `memory-wiki/page.tsx`, `agent-proposals-widget.tsx`, `ideas/page.tsx`, `content-os/page.tsx`, `hermes-dispatches.tsx`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `__dirname`, `HOST` to the rest of the system?**
  _608 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `bridge.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.12790697674418605 - nodes in this community are weakly interconnected._
- **Should `app/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._