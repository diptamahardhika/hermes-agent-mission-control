#!/usr/bin/env python3
"""Verification script for GitHub profile + status panel, dashboard home migration.

Checks source-level artifacts: env vars, API routes, page components, sidebar nav.
Does NOT try to verify runtime GitHub API data (that's not a static source check).
"""

import os
import re
import sys
from pathlib import Path

BASE = Path("/Users/pradiptamahardika/hermes-agent-mission-control")
ENV_FILE = BASE / ".env"
ROUTE_TS = BASE / "src/app/api/github/route.ts"
HOME_ROUTE_TS = BASE / "src/app/api/home/route.ts"
PAGE_TSX = BASE / "src/app/page.tsx"
SIDEBAR_TSX = BASE / "src/components/sidebar.tsx"
GITHUB_PAGE_TSX = BASE / "src/app/github/page.tsx"

errors = []

def check(condition, msg):
    if not condition:
        errors.append(msg)

README = "\n--- Verification Report ---\n"

# ── Environment ───────────────────────────────────────────────────────────
if ENV_FILE.exists():
    env = ENV_FILE.read_text()
    check('GITHUB_USERNAME="diptamahardhika"' in env,
          "GITHUB_USERNAME not in .env")
    check("GITHUB_TOKEN=" in env and len(env.split("GITHUB_TOKEN=")[1].split("\n")[0].strip()) > 0,
          "GITHUB_TOKEN not in .env")
    check('GITHUB_STATUS="Working on homelab-monitor' in env,
          "GITHUB_STATUS not in .env (custom status)")
else:
    errors.append(".env file missing")

# ── Dedicated API route ───────────────────────────────────────────────────
check(ROUTE_TS.exists(), "src/app/api/github/route.ts missing")
if ROUTE_TS.exists():
    rc = ROUTE_TS.read_text()
    check("export async function GET" in rc, "api/github route.ts missing GET handler")
    check("https://api.github.com/users/" in rc, "api/github does not call api.github.com/users/")
    check("pinned/repos" in rc, "api/github does not fetch pinned repos")
    check("users/" in rc and "/events" in rc, "api/github does not fetch user events")

# ── Home API route includes GitHub ────────────────────────────────────────
check(HOME_ROUTE_TS.exists(), "src/app/api/home/route.ts missing")
if HOME_ROUTE_TS.exists():
    hc = HOME_ROUTE_TS.read_text()
    check("githubProfileResult" in hc, "home route missing githubProfileResult")
    check("githubPinnedResult" in hc, "home route missing githubPinnedResult")
    check("githubReposResult" in hc, "home route missing githubReposResult")
    check("githubEventsResult" in hc, "home route missing githubEventsResult")
    check('"github": {' in hc, "home route missing github in response JSON")

# ── Dashboard home page ───────────────────────────────────────────────────
check(PAGE_TSX.exists(), "src/app/page.tsx missing")
if PAGE_TSX.exists():
    pc = PAGE_TSX.read_text()

    # Types
    check("interface GitHubProfile" in pc, "page.tsx missing GitHubProfile interface")
    check("interface GitHubRepo" in pc, "page.tsx missing GitHubRepo interface")
    check("interface GitHubActivity" in pc, "page.tsx missing GitHubActivity interface")
    check("interface GitHubHomeData" in pc, "page.tsx missing GitHubHomeData interface")

    # HomeData has github field
    check("github: GitHubHomeData" in pc, "page.tsx missing github field on HomeData")

    # EMPTY has github
    check("github: { profile: null, pinnedRepos: [], recentRepos: [], activity: null, status: null }" in pc,
          "page.tsx EMPTY missing github field")

    # GitHubHomeCard component
    check("function GitHubHomeCard" in pc, "page.tsx missing GitHubHomeCard component")
    check('src={profile.avatarUrl}' in pc, "GitHubHomeCard missing avatar image")
    check("profile.publicRepos" in pc, "GitHubHomeCard missing repo count")
    check("profile.followers" in pc, "GitHubHomeCard missing follower count")
    check("status &&" in pc and "animate-ping" in pc, "GitHubHomeCard missing status indicator")

    #Pinned repos rendering in dashboard
    check("pinnedRepos.slice" in pc, "GitHubHomeCard missing pinned repos slice")
    check("★" in pc or "star" in pc, "GitHubHomeCard missing stars indicator")
    check("GitBranch" in pc, "page.tsx missing GitBranch usage for activity")

    # Main Dashboard returns GitHub card
    check("data.github?.profile" in pc, "Dashboard missing data.github?.profile access")
    check("<GitHubHomeCard" in pc, "Dashboard missing GitHubHomeCard render")
    check('href="/github"' in pc, "Dashboard missing link to /github")

    # Imports
    import_match = re.search(r"import\s*\{([^}]+)\}\s*from\s*['\"]lucide-react['\"]", pc)
    if import_match:
        imgs = import_match.group(1)
        check("Github" in imgs, "page.tsx missing Github icon import")
        check("Star" in imgs, "page.tsx missing Star icon import")
        check("GitBranch" in imgs, "page.tsx missing GitBranch icon import")
        check("ArrowUpRight" in imgs, "page.tsx missing ArrowUpRight icon import")
    else:
        errors.append("page.tsx missing lucide-react import")

    # Removed YouTube from home
    check('"YouTube Subscribers"' not in pc, "page.tsx still has YouTube Subscribers MetricCard")

# ── Sidebar ───────────────────────────────────────────────────────────────
check(SIDEBAR_TSX.exists(), "src/components/sidebar.tsx missing")
if SIDEBAR_TSX.exists():
    sc = SIDEBAR_TSX.read_text()
    check("Github" in sc, "sidebar missing Github icon import")
    check('href="/github"' in sc, "sidebar missing /github link")
    check("GitHub" in sc, "sidebar missing 'GitHub' label")

    # Mobile tab bar
    mtb = re.search(r"const mobileTabsRaw\s*=\s*\[(.*?)\];", sc, re.DOTALL)
    if mtb:
        mc = mtb.group(1)
        check('"/github"' in mc, "mobile tab bar missing /github")
        check('"GitHub"' in mc, "mobile tab bar missing 'GitHub' label")
        check('"/youtube"' not in mc, "mobile tab bar still has YouTube")

# ── Dedicated GitHub page ─────────────────────────────────────────────────
check(GITHUB_PAGE_TSX.exists(), "src/app/github/page.tsx missing")
if GITHUB_PAGE_TSX.exists():
    gc = GITHUB_PAGE_TSX.read_text()
    check('"use client"' in gc, "github/page.tsx missing 'use client'")
    check("useState" in gc, "github/page.tsx missing useState")
    check("useEffect" in gc, "github/page.tsx missing useEffect")
    check("/api/github" in gc, "github/page.tsx not fetching /api/github")
    check("profile.avatarUrl" in gc, "github/page.tsx missing avatar")
    check("profile.bio" in gc, "github/page.tsx missing bio")
    check("profile.publicRepos" in gc, "github/page.tsx missing repo count")
    check("profile.followers" in gc, "github/page.tsx missing follower count")
    check("profile.following" in gc, "github/page.tsx missing following count")
    check("pinnedRepos" in gc, "github/page.tsx missing pinned repos")
    check("recentRepos" in gc, "github/page.tsx missing recent repos")
    check("pushesThisWeek" in gc, "github/page.tsx missing pushesThisWeek")
    check("pushesThisMonth" in gc, "github/page.tsx missing pushesThisMonth")
    check("reposThisWeek" in gc, "github/page.tsx missing reposThisWeek")
    check("p.bio" in gc, "github/page.tsx missing bio render")
    check("p.login" in gc, "github/page.tsx missing login render")
    check("p.company" in gc, "github/page.tsx missing company")
    check("p.location" in gc, "github/page.tsx missing location")
    check("Star" in gc, "github/page.tsx missing Star icon")
    check("GitBranch" in gc, "github/page.tsx missing GitBranch icon")
    check("Github" in gc, "github/page.tsx missing Github icon")
    for icon in ["Github", "Star", "GitBranch", "GitCommit", "Calendar", "Globe", "ArrowUpRight"]:
        check(icon in gc, f"github/page.tsx missing {icon}")

    # Language badge colors
    check("TypeScript" in gc, "github/page.tsx missing TypeScript badge color")
    check("JavaScript" in gc, "github/page.tsx missing JavaScript badge color")
    check("Python" in gc, "github/page.tsx missing Python badge color")

    # Private repo badge
    check("private" in gc and "amber" in gc, "github/page.tsx missing private badge")

    # Activity event rendering
    check("recentEvents" in gc and "map" in gc, "github/page.tsx missing recentEvents map")

    # Custom status rendering
    check("data.status &&" in gc or "status &&" in gc, "github/page.tsx missing status render")

# ── Summary ───────────────────────────────────────────────────────────────
print(README)

if not errors:
    print("ALL CHECKS PASSED")
    print("=" * 40)
    print("Files created/modified:")
    print(f"  • .env — GitHub vars added")
    print(f"  • src/app/api/github/route.ts — new API route")
    print(f"  • src/app/api/home/route.ts — GitHub data in home response")
    print(f"  • src/app/page.tsx — GitHubHomeCard on dashboard")
    print(f"  • src/components/sidebar.tsx — /github nav entry")
    print(f"  • src/app/github/page.tsx — full GitHub dashboard page")
    sys.exit(0)

print(f"FAIL — {len(errors)} issue(s):")
for i, e in enumerate(errors, 1):
    print(f"  {i}. {e}")
sys.exit(1)
