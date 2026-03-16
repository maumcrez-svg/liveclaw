#!/usr/bin/env bash
# Starts N FFmpeg streams pushing testsrc2 to RTMP.
# Usage: bash 02-run-streams.sh <N> [ramp_delay=3]
#
# Requires: DROPLET_IP env var (default: 165.227.91.241)
# Reads:    stream_keys.txt
# Produces: ffmpeg_pids.txt, ffmpeg_logs/

set -euo pipefail

N="${1:?Usage: 02-run-streams.sh <N> [ramp_delay]}"
RAMP_DELAY="${2:-3}"
DROPLET_IP="${DROPLET_IP:-165.227.91.241}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KEYS_FILE="$SCRIPT_DIR/stream_keys.txt"
PIDS_FILE="$SCRIPT_DIR/ffmpeg_pids.txt"
LOGS_DIR="$SCRIPT_DIR/ffmpeg_logs"

if [ ! -f "$KEYS_FILE" ]; then
  echo "ERROR: stream_keys.txt not found. Run 01-create-test-agents.sh first."
  exit 1
fi

total_available=$(wc -l < "$KEYS_FILE")
if [ "$N" -gt "$total_available" ]; then
  echo "ERROR: Requested $N streams but only $total_available keys available"
  exit 1
fi

mkdir -p "$LOGS_DIR"
> "$PIDS_FILE"

echo "Starting $N FFmpeg streams (ramp delay: ${RAMP_DELAY}s)..."
echo "Target: rtmp://$DROPLET_IP:1935"
echo ""

started=0
for i in $(seq 1 "$N"); do
  line=$(sed -n "${i}p" "$KEYS_FILE")
  [ -z "$line" ] && break

  slug=$(echo "$line" | cut -d'|' -f1)
  agent_id=$(echo "$line" | cut -d'|' -f2)
  stream_key=$(echo "$line" | cut -d'|' -f3)

  log_file="$LOGS_DIR/${slug}.log"

  ffmpeg \
    -re \
    -f lavfi -i "testsrc2=size=1280x720:rate=30" \
    -f lavfi -i "sine=frequency=440:sample_rate=44100" \
    -c:v libx264 -preset ultrafast -tune zerolatency \
    -b:v 2500k -maxrate 2500k -bufsize 5000k \
    -g 60 -keyint_min 60 \
    -c:a aac -b:a 128k -ac 2 \
    -f flv "rtmp://${DROPLET_IP}:1935/${stream_key}" \
    > "$log_file" 2>&1 &

  pid=$!
  echo "$pid|$slug|$stream_key" >> "$PIDS_FILE"
  started=$((started + 1))
  echo "  [$started/$N] $slug → PID $pid"

  if [ "$started" -lt "$N" ]; then
    sleep "$RAMP_DELAY"
  fi
done

echo ""
echo "All $started streams started."
echo "PIDs saved to: $PIDS_FILE"
echo "Logs in: $LOGS_DIR/"
echo ""
echo "Monitor with: tail -f $LOGS_DIR/*.log"
