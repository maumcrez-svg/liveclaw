#!/usr/bin/env bash
# Verifies agents went live (or offline after stop) via the API.
# Usage:
#   bash 05-verify-webhooks.sh [N=all]              # check for "live"
#   bash 05-verify-webhooks.sh [N=all] --offline     # check for "offline"
#
# Requires: API_URL env var

set -euo pipefail

N="${1:-0}"
MODE="live"
if [[ "${2:-}" == "--offline" ]]; then
  MODE="offline"
fi

: "${API_URL:?Set API_URL}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KEYS_FILE="$SCRIPT_DIR/stream_keys.txt"

if [ ! -f "$KEYS_FILE" ]; then
  echo "ERROR: stream_keys.txt not found."
  exit 1
fi

total_available=$(wc -l < "$KEYS_FILE")
[ "$N" -eq 0 ] && N="$total_available"

echo "Verifying $N agents are '$MODE' via API..."
echo ""

pass=0
fail=0
checked=0
start_time=$(date +%s)

while IFS='|' read -r slug agent_id stream_key; do
  [ "$checked" -ge "$N" ] && break
  checked=$((checked + 1))

  response=$(curl -s --max-time 5 "$API_URL/agents/$slug" 2>/dev/null || echo '{"status":"error"}')
  status=$(echo "$response" | jq -r '.status // "unknown"')
  has_hls=$(echo "$response" | jq -r '.hlsPath // empty')

  if [ "$MODE" = "live" ]; then
    if [ "$status" = "live" ] && [ -n "$has_hls" ]; then
      echo "  PASS  $slug — live, hlsPath present"
      pass=$((pass + 1))
    else
      echo "  FAIL  $slug — status=$status, hlsPath=${has_hls:-none}"
      fail=$((fail + 1))
    fi
  else
    if [ "$status" = "offline" ]; then
      echo "  PASS  $slug — offline"
      pass=$((pass + 1))
    else
      echo "  FAIL  $slug — status=$status (expected offline)"
      fail=$((fail + 1))
    fi
  fi
done < "$KEYS_FILE"

end_time=$(date +%s)
elapsed=$((end_time - start_time))

echo ""
echo "Results: $pass pass / $fail fail / $checked checked (${elapsed}s)"

# Check production agents are unaffected
echo ""
echo "Production agent check:"
for prod_slug in sarah pepe-news artisan; do
  prod_resp=$(curl -s --max-time 5 "$API_URL/agents/$prod_slug" 2>/dev/null || echo '{"error":"unreachable"}')
  prod_status=$(echo "$prod_resp" | jq -r '.status // "error"')
  echo "  $prod_slug → $prod_status"
done
