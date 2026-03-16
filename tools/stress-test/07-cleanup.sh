#!/usr/bin/env bash
# Full cleanup: stops streams, waits for webhooks, deletes test agents, removes local files.
# Usage: bash 07-cleanup.sh

set -euo pipefail

: "${API_URL:?Set API_URL}"
: "${ADMIN_TOKEN:?Set ADMIN_TOKEN}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDS_FILE="$SCRIPT_DIR/ffmpeg_pids.txt"
IDS_FILE="$SCRIPT_DIR/agent_ids.txt"
KEYS_FILE="$SCRIPT_DIR/stream_keys.txt"
LOGS_DIR="$SCRIPT_DIR/ffmpeg_logs"

# 1. Stop streams if still running
if [ -f "$PIDS_FILE" ]; then
  echo "=== Stopping streams ==="
  bash "$SCRIPT_DIR/03-stop-streams.sh" || true
  echo ""
fi

# 2. Wait for unpublish webhooks
echo "=== Waiting 15s for unpublish webhooks ==="
sleep 15

# 3. Delete test agents via API
if [ -f "$IDS_FILE" ]; then
  echo "=== Deleting test agents ==="
  deleted=0
  failed=0
  total=$(wc -l < "$IDS_FILE")

  while IFS= read -r agent_id; do
    [ -z "$agent_id" ] && continue

    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
      -X DELETE "$API_URL/agents/$agent_id" \
      -H "Authorization: Bearer $ADMIN_TOKEN")

    if [ "$http_code" = "200" ] || [ "$http_code" = "204" ]; then
      deleted=$((deleted + 1))
    else
      failed=$((failed + 1))
      echo "  FAIL: agent $agent_id → HTTP $http_code"
    fi
  done < "$IDS_FILE"

  echo "  Deleted $deleted/$total agents ($failed failed)"
  echo ""
fi

# 4. Clean local files
echo "=== Cleaning local files ==="
rm -f "$PIDS_FILE" "$IDS_FILE" "$KEYS_FILE"
rm -rf "$LOGS_DIR"
echo "  Removed: ffmpeg_pids.txt, agent_ids.txt, stream_keys.txt, ffmpeg_logs/"

echo ""
echo "Cleanup complete."
