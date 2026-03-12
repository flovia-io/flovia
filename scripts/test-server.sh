#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Integration test script for the mydev cloud server
#
# Usage:  ./scripts/test-server.sh [PORT]
# ──────────────────────────────────────────────────────────────────────────────
set -uo pipefail

PORT="${1:-3001}"
BASE="http://localhost:${PORT}"
PASS=0
FAIL=0
TOTAL=0

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

check() {
  local label="$1"
  local url="$2"
  local method="${3:-GET}"
  local body="${4:-}"
  local expect="${5:-200}"
  TOTAL=$((TOTAL + 1))

  if [ "$method" = "POST" ] && [ -n "$body" ]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "$body" "$url")
  else
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  fi

  if [ "$status" = "$expect" ]; then
    green "  ✓ $label ($status)"
    PASS=$((PASS + 1))
  else
    red "  ✗ $label (expected $expect, got $status)"
    FAIL=$((FAIL + 1))
  fi
}

bold "🧪 mydev server integration tests (${BASE})"
echo ""

# ── Health ──
bold "Health"
check "GET /api/health" "${BASE}/api/health"
echo ""

# ── AI ──
bold "AI"
check "GET /api/ai/settings"       "${BASE}/api/ai/settings"
check "GET /api/ai/check-ollama"   "${BASE}/api/ai/check-ollama"
check "POST /api/ai/list-models"   "${BASE}/api/ai/list-models" POST '{"baseUrl":"http://localhost:11434/v1","apiKey":"ollama"}'
check "POST /api/ai/settings"      "${BASE}/api/ai/settings" POST '{"provider":"ollama","baseUrl":"http://localhost:11434/v1","apiKey":"ollama","selectedModel":"test"}'
echo ""

# ── Prompts ──
bold "Prompts"
check "GET  /api/prompts"          "${BASE}/api/prompts"
check "POST /api/prompts/reset"    "${BASE}/api/prompts/reset" POST '{}'
echo ""

# ── History ──
bold "Chat History"
check "GET  /api/history"                      "${BASE}/api/history"
check "GET  /api/history/recent-workspaces"    "${BASE}/api/history/recent-workspaces"
check "POST /api/history/open-workspace"       "${BASE}/api/history/open-workspace" POST '{"folderPath":"/tmp/mydev-test"}'
check "POST /api/history/conversation/create"  "${BASE}/api/history/conversation/create" POST '{"folderPath":"/tmp/mydev-test","mode":"Chat"}'
check "POST /api/history/workspace"            "${BASE}/api/history/workspace" POST '{"folderPath":"/tmp/mydev-test"}'
echo ""

# ── File System ──
bold "File System"
check "POST /api/fs/open-folder"   "${BASE}/api/fs/open-folder" POST '{"folderPath":"/tmp"}'
check "POST /api/fs/read-file"     "${BASE}/api/fs/read-file" POST '{"filePath":"/etc/hosts"}' "200"
check "POST /api/fs/refresh-tree"  "${BASE}/api/fs/refresh-tree" POST '{"folderPath":"/tmp"}'
echo ""

# ── Connectors ──
bold "Connectors"
check "GET /api/connectors"                       "${BASE}/api/connectors"
check "GET /api/connectors/github"                 "${BASE}/api/connectors/github"
check "GET /api/connectors/atlassian"              "${BASE}/api/connectors/atlassian"
check "GET /api/connectors/supabase"               "${BASE}/api/connectors/supabase"
check "GET /api/connectors/nonexistent"            "${BASE}/api/connectors/nonexistent" "GET" "" "404"
echo ""

# ── Atlassian ──
bold "Atlassian"
check "GET /api/atlassian/connections" "${BASE}/api/atlassian/connections"
echo ""

# ── Summary ──
echo ""
bold "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$FAIL" -eq 0 ]; then
  green "  All ${TOTAL} tests passed ✓"
else
  red "  ${FAIL}/${TOTAL} tests failed"
fi
bold "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit "$FAIL"
