#!/usr/bin/env bash
# Verifies HLS playlists are accessible and contain segments.
# Usage: bash 04-verify-hls.sh [N=all]
#
# Requires: DROPLET_IP env var (default: 165.227.91.241)
# Reads:    stream_keys.txt

set -euo pipefail

N="${1:-0}"
DROPLET_IP="${DROPLET_IP:-165.227.91.241}"
HLS_BASE="http://${DROPLET_IP}:8888"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KEYS_FILE="$SCRIPT_DIR/stream_keys.txt"

if [ ! -f "$KEYS_FILE" ]; then
  echo "ERROR: stream_keys.txt not found."
  exit 1
fi

total_available=$(wc -l < "$KEYS_FILE")
[ "$N" -eq 0 ] && N="$total_available"

echo "Verifying HLS for $N streams at $HLS_BASE"
echo ""

pass=0
fail=0
checked=0

while IFS='|' read -r slug agent_id stream_key; do
  [ "$checked" -ge "$N" ] && break
  checked=$((checked + 1))

  url="${HLS_BASE}/${stream_key}/index.m3u8"
  response=$(curl -s -o /tmp/hls_check.m3u8 -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")

  if [ "$response" = "200" ]; then
    # Master playlist contains sub-playlist refs (.m3u8) or direct segments
    segments=$(grep -cE '\.(ts|m4s|mp4|m3u8)' /tmp/hls_check.m3u8 2>/dev/null || true)
    segments="${segments:-0}"
    if [ "$segments" -gt 0 ]; then
      echo "  PASS  $slug — HTTP 200, $segments refs"
      pass=$((pass + 1))
    else
      echo "  FAIL  $slug — HTTP 200 but 0 refs"
      fail=$((fail + 1))
    fi
  else
    echo "  FAIL  $slug — HTTP $response"
    fail=$((fail + 1))
  fi
done < "$KEYS_FILE"

echo ""
echo "Results: $pass pass / $fail fail / $checked checked"

if [ "$fail" -gt 0 ]; then
  pct_fail=$((fail * 100 / checked))
  echo "Failure rate: ${pct_fail}%"
  if [ "$pct_fail" -gt 20 ]; then
    echo "⚠ HARD FAILURE: >20% streams without HLS output. Stop the test."
  fi
fi
