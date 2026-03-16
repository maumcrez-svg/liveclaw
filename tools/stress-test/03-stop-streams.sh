#!/usr/bin/env bash
# Stops all FFmpeg streams started by 02-run-streams.sh.
# Usage: bash 03-stop-streams.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDS_FILE="$SCRIPT_DIR/ffmpeg_pids.txt"

if [ ! -f "$PIDS_FILE" ]; then
  echo "No ffmpeg_pids.txt found. Nothing to stop."
  exit 0
fi

echo "Stopping FFmpeg streams..."

stopped=0
while IFS= read -r line; do
  pid=$(echo "$line" | cut -d'|' -f1)
  slug=$(echo "$line" | cut -d'|' -f2)
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null && echo "  SIGTERM → $slug (PID $pid)" && stopped=$((stopped + 1))
  else
    echo "  SKIP → $slug (PID $pid) — already dead"
  fi
done < "$PIDS_FILE"

echo "Sent SIGTERM to $stopped processes. Waiting 3s for graceful exit..."
sleep 3

# Force-kill stragglers
force=0
while IFS= read -r line; do
  pid=$(echo "$line" | cut -d'|' -f1)
  slug=$(echo "$line" | cut -d'|' -f2)
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null && echo "  SIGKILL → $slug (PID $pid)" && force=$((force + 1))
  fi
done < "$PIDS_FILE"

if [ "$force" -gt 0 ]; then
  echo "Force-killed $force straggler(s)."
fi

echo "All streams stopped."
