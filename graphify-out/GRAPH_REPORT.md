# Graph Report - hermes-agent-mission-control  (2026-09-02)

## Corpus Check
- 185 files · ~141,380 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1206 nodes · 1719 edges · 117 communities (73 shown, 36 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Config & Linting
- Hermes Bridge
- Dashboard Pages
- Watchlist Radar
- Auth & Database
- AI Article Generation
- Agents Dashboard
- TypeScript Config
- Layout & Fonts
- Hermes Runs UI
- src app api ai news route
- src app api articles generate 
- src app hermes page
- ref icons 128x128 2x png
- src app memory wiki page
- crypto
- src components agent proposals
- scanner outlier scanner
- src app articles page
- src app garden page
- src app articles page articles
- src app content os page
- src lib github review
- src app api agents route
- src app tasks page
- src app youtube page outlierfe
- prisma seed
- src app homelab page
- src app longform page longform
- hermes bridge package
- src app api ideas route
- src app api pixel findings rou
- src app api tasks route
- src app page fmt
- src app youtube page funnelton
- hermes bridge smoke test
- src app api homelab route
- src app github page
- hermes bridge watchdog
- child process
- src app api agent chat route
- src app api github route
- src app api sage findings rout
- src app api x content route
- src app client pulse page
- prisma seed all
- ref core default
- src app api github pr opened r
- src app api freellm route
- src app api trends route
- src app page cryptoportfolioca
- src components sparkline
- src app api articles route
- src app api scrape metrics rou
- src app api x content generate
- src app api x content request 
- src app page dashboard
- src components hermes dispatch
- src lib readme validator
- src app api agent bus route
- src app api articles revise ro
- src app api articles saved tit
- src app api auth nextauth rout
- src app api cache clear route
- src app api hermes crons route
- src app api longform generate 
- src app api longform route
- src app api score route
- src app api x content tweak ro
- src app api x content visual r
- src app api youtube generate r
- src app api youtube performanc
- src app api youtube scripts ro
- prisma seed datastore
- ref iad1
- src app api articles generate 
- src app api client pulse route
- src app api garden route
- src app api tasks format route
- src app api watchlist radar ro
- src app api x analytics route
- src app api x content feedback
- src app api x content viral sc
- src app api youtube ideas gene
- src app api youtube ideas rout
- src components hlpnlchart
- src app api hermes cost route
- src app api hermes tasks diagn
- src app api hermes tasks retry
- src app api hermes tasks unblo
- src app api longform tweak rou
- src app api trends snipe route
- src app api trends update rout
- src app api x content mark pos
- src app api x content top twee
- src app api youtube outliers r
- src app api youtube scrape rou
- src components breadcrumbs
- src components donut chart
- src lib google creds
- src middleware
- src types next auth d
- eslint config
- infra postgres setup
- infra postgres update env
- next config
- postcss config
- src app page scoregauge
- pkg app

## God Nodes (most connected - your core abstractions)
1. `prisma` - 49 edges
2. `EmptyState()` - 16 edges
3. `compilerOptions` - 16 edges
4. `mirrorTick()` - 12 edges
5. `YouTubePage()` - 12 edges
6. `Panel()` - 12 edges
7. `Pill()` - 12 edges
8. `fetchUrlContent()` - 12 edges
9. `log()` - 11 edges
10. `runRequest()` - 11 edges

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

## Communities (117 total, 36 thin omitted)

### Community 0 - "Config & Linting"
Cohesion: 0.04
Nodes (45): eslint, eslint-config-next, allowScripts, better-sqlite3@12.11.1, esbuild@0.28.2, fsevents@2.3.3, prisma@6.19.2, @prisma/client@6.19.2 (+37 more)

### Community 1 - "Hermes Bridge"
Cohesion: 0.13
Nodes (42): briefPrompt(), cachedInfCfg, cleanStaleLocks(), currentInferenceProvider(), __dirname, driftHealedAt, emit(), ensureTempKanbanDb() (+34 more)

### Community 2 - "Dashboard Pages"
Cohesion: 0.05
Nodes (33): AINewsData, BoardIdea, BuildIdea, CATEGORY_COLOR, CATEGORY_LABEL, Draft, FREELLM_TOK_COLORS, FreeLLMData (+25 more)

### Community 3 - "Watchlist Radar"
Cohesion: 0.07
Nodes (35): Signal, SignalCard(), timeAgo(), WatchlistData, WatchlistRadarPage(), AnalyticsData, DAYS, fmt() (+27 more)

### Community 4 - "Auth & Database"
Cohesion: 0.05
Nodes (39): @auth/prisma-adapter, better-sqlite3, drizzle-orm, formidable, googleapis, grammy, lucide-react, next (+31 more)

### Community 5 - "AI Article Generation"
Cohesion: 0.07
Nodes (8): dynamic, isAuthorized(), POST(), maxDuration, dynamic, dynamic, globalForPrisma, prisma

### Community 6 - "Agents Dashboard"
Cohesion: 0.06
Nodes (19): Agent, AgentActivity, AgentCard(), AgentChat(), AgentProposal, AgentsPage(), roleColors, statusConfig (+11 more)

### Community 7 - "TypeScript Config"
Cohesion: 0.06
Nodes (30): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+22 more)

### Community 8 - "Layout & Fonts"
Cohesion: 0.08
Nodes (20): geist, geistMono, metadata, viewport, CommandPalette(), NAV, NavItem, Row (+12 more)

### Community 9 - "Hermes Runs UI"
Cohesion: 0.10
Nodes (27): Cost, duration(), Filter, FILTERS, fmtTokens(), fmtUsd(), getJSON(), HermesRuns() (+19 more)

### Community 10 - "src app api ai news route"
Cohesion: 0.13
Nodes (23): decodeEntities(), deriveTags(), dynamic, fetchHN(), fetchNews(), GET(), ModelCard, NEWS_FEEDS (+15 more)

### Community 11 - "src app api articles generate "
Cohesion: 0.12
Nodes (23): dynamic, maxDuration, POST(), TRACK_FORMULAS, dynamic, maxDuration, POST(), TRACK_DESCRIPTIONS (+15 more)

### Community 12 - "src app hermes page"
Cohesion: 0.12
Nodes (26): ActivityFeed(), COLUMN_LABEL, COLUMN_ORDER, columnFor(), columnTone(), CronJob, CronPanel(), DispatchBar() (+18 more)

### Community 13 - "ref icons 128x128 2x png"
Cohesion: 0.09
Nodes (22): icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, icons/icon.ico, app, security, windows (+14 more)

### Community 14 - "src app memory wiki page"
Cohesion: 0.13
Nodes (19): ConfidenceDot(), confidenceMeta(), confidenceValue(), Draft, draftFrom(), emptyDraft(), Entry, EntryCard() (+11 more)

### Community 15 - "crypto"
Cohesion: 0.13
Nodes (12): BN_CACHE, BoardIdeaRoute, dynamic, extractMetrics(), formatHermesKanban(), GET(), GH_CACHE, HERMES_KANBAN_DEMO_TASKS (+4 more)

### Community 16 - "src components agent proposals"
Cohesion: 0.14
Nodes (14): FilterMode, Proposal, SortMode, InboxCard(), Req, timeAgo(), Briefing, HermesBriefing() (+6 more)

### Community 17 - "scanner outlier scanner"
Cohesion: 0.22
Nodes (16): API_KEYS, fetchJSON(), formatDuration(), fs, getApiKey(), getChannelInfo(), getChannelMedianViews(), getVideoDetails() (+8 more)

### Community 18 - "src app articles page"
Cohesion: 0.11
Nodes (11): Article, CalendarTabProps, ChatMessage, ComposeTabProps, LibraryTabProps, SavedTitle, STATUS_COLUMNS, Tab (+3 more)

### Community 19 - "src app garden page"
Cohesion: 0.17
Nodes (11): EMPTY_FORM, GardenBlob, Plant, LongformScript, TONE, Idea, LongformTab, Script (+3 more)

### Community 20 - "src app articles page articles"
Cohesion: 0.13
Nodes (12): ArticlesPageContent(), GardenPage(), AGENTS, CATEGORY_CONFIG, DispatchInfo, formatDate(), Idea, IdeaCard() (+4 more)

### Community 21 - "src app content os page"
Cohesion: 0.20
Nodes (14): bestViews(), ColKey, COLS, ContentOSPage(), Draft, fmt(), isTweet(), PipelineCard() (+6 more)

### Community 22 - "src lib github review"
Cohesion: 0.20
Nodes (14): checkUnusedDeps(), DANGEROUS_PATTERNS, DEBUG_PATTERNS, getRepoPath(), performSecurityReview(), REPO_MAP, ReviewFinding, ReviewResult (+6 more)

### Community 23 - "src app api agents route"
Cohesion: 0.18
Nodes (13): Activity, ACTIVITY_PROFILE_MAP, DEFAULT_AGENTS, dynamic, execFileP, GET(), hermesKanbanActivity(), hermesKanbanLive() (+5 more)

### Community 24 - "src app tasks page"
Cohesion: 0.20
Nodes (15): columns, STATUS_COLORS, statusColor(), Task, TaskCard(), TaskDraft, TaskEditor(), TasksPage() (+7 more)

### Community 25 - "src app youtube page outlierfe"
Cohesion: 0.17
Nodes (15): OutlierFeed, analyzeTitlePatterns(), formatNumber(), MinScore, NICHE_COLORS, NicheCount, OutlierData, OutlierFeed() (+7 more)

### Community 26 - "prisma seed"
Cohesion: 0.41
Nodes (14): main(), prisma, readJson(), safeDate(), seedAgentState(), seedContentCalendar(), seedContentRequests(), seedDrafts() (+6 more)

### Community 27 - "src app homelab page"
Cohesion: 0.17
Nodes (12): Container, EMPTY, fmtBytesPerSec(), fmtMB(), HistoryStats, HomelabData, HomelabPage(), ServerStatus (+4 more)

### Community 28 - "src app longform page longform"
Cohesion: 0.26
Nodes (13): LongFormPage(), approveAndGenerate(), copySpokenText(), PostedCard(), saveTw(), saveYt(), scrapeAndUpdate(), PostModal() (+5 more)

### Community 29 - "hermes bridge package"
Cohesion: 0.15
Nodes (12): bin, hermes-bridge, dependencies, pg, description, pg, name, private (+4 more)

### Community 30 - "src app api ideas route"
Cohesion: 0.21
Nodes (9): AGENT_PROFILES, DispatchInfo, DispatchState, dynamic, enrichWithDispatch(), GET(), POST(), requestKey() (+1 more)

### Community 31 - "src app api pixel findings rou"
Cohesion: 0.29
Nodes (10): ensureFindingsDir(), FINDINGS_DIR, GET(), getReviewHistory(), listFindings(), PixelFinding, POST(), ReviewSummary (+2 more)

### Community 32 - "src app api tasks route"
Cohesion: 0.35
Nodes (11): DELETE(), GET(), parseFrontmatter(), PATCH(), POST(), safeFileName(), serializeFrontmatter(), TaskData (+3 more)

### Community 33 - "src app page fmt"
Cohesion: 0.21
Nodes (12): fmt(), fmtExact(), FreeLLMShareBars(), FreeLLMSpendPanel(), modelProvider(), ModelShareBars(), OmniRoutePanel(), OmniShareBars() (+4 more)

### Community 34 - "src app youtube page funnelton"
Cohesion: 0.24
Nodes (7): funnelTone(), YouTubePage(), deleteScript(), rejectIdea(), RejectModal(), ScriptCard(), updateScript()

### Community 35 - "hermes bridge smoke test"
Cohesion: 0.18
Nodes (9): checks, __dirname, execFileP, existingSet, optionalTables, pool, NOTE: pg returns jsonb columns as parsed JS objects, not strings., requiredTables (+1 more)

### Community 36 - "src app api homelab route"
Cohesion: 0.20
Nodes (10): Container, dynamic, GET(), HistoryStats, revalidate, ServerStatus, ServiceStatus, summarize() (+2 more)

### Community 37 - "src app github page"
Cohesion: 0.25
Nodes (10): ActivitySummary, EMPTY, fmt(), GitHubData, GitHubPage(), GitHubProfile, langBadge(), Repo (+2 more)

### Community 38 - "hermes bridge watchdog"
Cohesion: 0.33
Nodes (9): BRIDGE_DIR, BRIDGE_SCRIPT, isBridgeRunning(), log(), LOG_FILE, main(), PID_FILE, startBridge() (+1 more)

### Community 39 - "child process"
Cohesion: 0.44
Nodes (7): epochToIso(), execFileP, firstLine(), GET(), POST(), shJson(), toProposal()

### Community 40 - "src app api agent chat route"
Cohesion: 0.39
Nodes (8): AgentChatRequest, AgentId, AGENTS, execFileP, firstReplyAfter(), lastAssistantId(), POST(), profileHome()

### Community 41 - "src app api github route"
Cohesion: 0.28
Nodes (8): ActivitySummary, avatarUrl(), dynamic, GET(), headers(), Profile, Repo, revalidate

### Community 42 - "src app api sage findings rout"
Cohesion: 0.31
Nodes (8): categorize(), dynamic, execFileP, Finding, GET(), revalidate, SageCategory, sageFindings()

### Community 43 - "src app api x content route"
Cohesion: 0.36
Nodes (7): bestViews(), draftToApi(), dynamic, GET(), mergeMetrics(), PATCH(), POST()

### Community 44 - "src app client pulse page"
Cohesion: 0.28
Nodes (8): categoryLabel, categoryTone, ClientPulsePage(), dateLabel(), PulseClient, PulseData, scoreColor(), SectionHeader()

### Community 45 - "prisma seed all"
Cohesion: 0.43
Nodes (7): execSqlite(), JsonValue, main(), prisma, seedAgentStateFromKanban(), seedDatastore(), upsert()

### Community 46 - "ref core default"
Cohesion: 0.25
Nodes (7): core:default, main, description, identifier, permissions, $schema, windows

### Community 47 - "src app api github pr opened r"
Cohesion: 0.36
Nodes (6): dynamic, enqueuePixelReview(), execFileP, POST(), revalidate, verifySignature()

### Community 48 - "src app api freellm route"
Cohesion: 0.38
Nodes (6): authFetch(), dynamic, FREELLM_BASE, GET(), getSessionToken(), revalidate

### Community 49 - "src app api trends route"
Cohesion: 0.33
Nodes (6): dynamic, GET(), readTrendData(), revalidate, Trend, TrendsResponse

### Community 50 - "src app page cryptoportfolioca"
Cohesion: 0.29
Nodes (7): CryptoPortfolioCard(), HomelabHomeCard(), renderWithLinks(), SageFindingsPanel(), timeAgo(), YouTubeCard(), YouTubeVideoTabs()

### Community 51 - "src components sparkline"
Cohesion: 0.38
Nodes (5): Sparkline(), SparklineProps, MetricCard(), MetricCardProps, useCountUp()

### Community 53 - "src app api scrape metrics rou"
Cohesion: 0.47
Nodes (5): dynamic, getTwitterMetrics(), getYouTubeMetrics(), maxDuration, POST()

### Community 54 - "src app api x content generate"
Cohesion: 0.53
Nodes (5): ACCENT_COLORS, esc(), POST(), stripBullet(), wrapText()

### Community 56 - "src app page dashboard"
Cohesion: 0.40
Nodes (6): Dashboard(), EMPTY, greeting(), sampleSeries(), snapDelta(), withDevPreview()

### Community 57 - "src components hermes dispatch"
Cohesion: 0.40
Nodes (5): ago(), HermesDispatches(), LABEL, Req, TONE

### Community 58 - "src lib readme validator"
Cohesion: 0.47
Nodes (5): ExampleResult, extractCodeExamples(), ReadmeValidationResult, validateExample(), validateReadmeExamples()

### Community 60 - "src app api articles revise ro"
Cohesion: 0.50
Nodes (4): braveSearch(), dynamic, maxDuration, POST()

### Community 62 - "src app api auth nextauth rout"
Cohesion: 0.50
Nodes (3): handler, authOptions, TODO: Add PrismaAdapter once DB-backed sessions are needed.

### Community 64 - "src app api hermes crons route"
Cohesion: 0.50
Nodes (3): CronJob, GET(), parseCrons()

### Community 65 - "src app api longform generate "
Cohesion: 0.60
Nodes (4): braveSearch(), callLLM(), maxDuration, POST()

### Community 67 - "src app api score route"
Cohesion: 0.50
Nodes (4): dynamic, GET(), revalidate, weeklyGithubContributions()

### Community 68 - "src app api x content tweak ro"
Cohesion: 0.40
Nodes (3): dynamic, TODO: This path won't exist on Vercel — consider bundling voice-rules or…, VOICE_RULES

### Community 70 - "src app api youtube generate r"
Cohesion: 0.70
Nodes (4): braveSearch(), callOpenAI(), fetchArticle(), POST()

### Community 71 - "src app api youtube performanc"
Cohesion: 0.60
Nodes (4): dynamic, GET(), getAllVideos(), parseIsoDuration()

### Community 73 - "prisma seed datastore"
Cohesion: 0.67
Nodes (3): main(), prisma, upsert()

### Community 74 - "ref iad1"
Cohesion: 0.50
Nodes (3): iad1, crons, regions

### Community 76 - "src app api client pulse route"
Cohesion: 0.67
Nodes (3): AnalysisWithClient, asStringArray(), GET()

### Community 78 - "src app api tasks format route"
Cohesion: 0.67
Nodes (3): extractJson(), FormattedTask, POST()

### Community 80 - "src app api x analytics route"
Cohesion: 0.67
Nodes (3): dynamic, extractMetrics(), GET()

### Community 82 - "src app api x content viral sc"
Cohesion: 0.67
Nodes (3): analyzeContent(), dynamic, POST()

### Community 83 - "src app api youtube ideas gene"
Cohesion: 0.83
Nodes (3): braveSearch(), callOpenAI(), POST()

### Community 85 - "src components hlpnlchart"
Cohesion: 0.67
Nodes (3): ChartPoint, fmt(), HLPnlChart()

## Knowledge Gaps
- **449 isolated node(s):** `eslintConfig`, `__dirname`, `HOST`, `POLL_MS`, `MIRROR_MS` (+444 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 614 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `AI Article Generation` to `crypto`, `src app api agents route`, `src app api ideas route`, `src app api homelab route`, `child process`, `src app api x content route`, `src app api trends route`, `src app api articles route`, `src app api scrape metrics rou`, `src app api x content generate`, `src app api x content request `, `src app api agent bus route`, `src app api articles saved tit`, `src app api hermes crons route`, `src app api longform route`, `src app api score route`, `src app api x content tweak ro`, `src app api x content visual r`, `src app api youtube scripts ro`, `src app api articles generate `, `src app api client pulse route`, `src app api garden route`, `src app api watchlist radar ro`, `src app api x analytics route`, `src app api x content feedback`, `src app api youtube ideas gene`, `src app api youtube ideas rout`, `src app api hermes briefing ro`, `src app api hermes cost route`, `src app api trends snipe route`, `src app api trends update rout`, `src app api x content mark pos`, `src app api youtube outliers r`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `EmptyState()` connect `src app garden page` to `Watchlist Radar`, `Hermes Runs UI`, `src app hermes page`, `src app client pulse page`, `src app memory wiki page`, `src components agent proposals`, `src app articles page articles`, `src app content os page`, `src components hermes dispatch`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `Skeleton()` connect `src app garden page` to `Dashboard Pages`, `src app hermes page`, `src app client pulse page`, `src app memory wiki page`, `src app articles page`, `src app articles page articles`, `src app content os page`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `__dirname`, `HOST` to the rest of the system?**
  _449 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Config & Linting` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `Hermes Bridge` be split into smaller, more focused modules?**
  _Cohesion score 0.1273532668881506 - nodes in this community are weakly interconnected._
- **Should `Dashboard Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._