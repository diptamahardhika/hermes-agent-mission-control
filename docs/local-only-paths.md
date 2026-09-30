# Local-only code paths

Several routes write **trigger files** to the local filesystem for the Hermes
agents to pick up, plus read a couple of bundled data files. These paths work
when the dashboard runs on this machine — dev server on `:8888`, or the
`hermy-hq-dashboard` Docker container on `:8080` — and **will not work on a
serverless host like Vercel**, where the filesystem is read-only and
ephemeral.

This is intentional, not an outstanding bug. The dashboard is deployed to
Docker on your own hardware, and the agent that consumes these files
(Nova/Sage) runs on the same machine, watching the directory.

## The affected paths

| Route | What it does |
|---|---|
| `api/longform/tweak` | Writes a trigger file to `./data/triggers` |
| `api/x-content/feedback` | Writes a trigger file to `./data/triggers` |
| `api/x-content/request` | Writes a trigger file to `./data/triggers` |
| `api/x-content/tweak` | Reads voice rules from `./data/tweet-library/voice-rules.md` |
| `api/home` | Reads `./data/coq-finance.json` |

## If this ever needs to run on Vercel

The filesystem approach has to be replaced end to end, not just patched. A
trigger file is only half the mechanism — something has to be watching the
directory and running the work, and that is the part a queue or webhook would
also have to replace. A minimal version would be:

1. Write trigger *rows* to the existing `DataStore` table (already Prisma-backed
   and reachable from any host) instead of files.
2. Have the agent poll that table, or post to a webhook, rather than watch a
   directory.
3. Bundle the read-only data files (`voice-rules.md`, `coq-finance.json`) as
   imports, or move them into the database.

Do this only if there is a real reason to move off the local Docker setup —
it is a multi-service change with agent-side work, not a config tweak.
