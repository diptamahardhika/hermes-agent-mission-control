#!/usr/bin/env bash
# Snapshot every GET-able API route's response body, for before/after
# comparison across a refactor. Read-only: GET requests only, no mutations.
set -uo pipefail
OUT="${1:?usage: api-snapshot.sh <outdir>}"
BASE="${BASE:-http://localhost:8888}"
mkdir -p "$OUT"
: > "$OUT/_status.txt"

ROUTES=(
  "/api/home"
  "/api/hermes/requests?take=15"
  "/api/hermes/requests?status=awaiting_approval&take=50"
  "/api/hermes/cost"
  "/api/hermes/briefing"
  "/api/hermes/memory?status=active"
  "/api/omniroute/cost"
  "/api/x-content"
  "/api/github"
  "/api/agents"
  "/api/articles"
  "/api/articles/saved-titles"
  "/api/longform"
  "/api/sage-findings"
  "/api/agent-bus"
  "/api/agent-proposals"
  "/api/hermes/decisions"
  "/api/score"
)

for r in "${ROUTES[@]}"; do
  name=$(printf '%s' "$r" | tr '/?=&' '____' | tr -cd '[:alnum:]_.-')
  code=$(curl -s --max-time 30 -o "$OUT/$name.body" -w '%{http_code}' "$BASE$r")
  printf '%s %s\n' "$code" "$r" >> "$OUT/_status.txt"
done

echo "snapshot -> $OUT"
cat "$OUT/_status.txt"
