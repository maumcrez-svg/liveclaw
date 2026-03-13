#!/bin/bash
# One-time cleanup: fix PulseAudio audio leak between agents
# Run this on the Droplet BEFORE restarting agents
set -e

echo "=== PulseAudio Cleanup ==="

# 1. Unload ALL null-sink modules (duplicates + originals)
echo "Unloading all null-sink modules..."
for mod in $(pactl list short modules | grep null-sink | awk '{print $1}'); do
  pactl unload-module "$mod" 2>/dev/null || true
done

# 2. Delete stream-restore database so PulseAudio forgets stale Chromium→sink mappings
echo "Clearing stream-restore database..."
rm -f ~/.config/pulse/*-stream-volumes.tdb
rm -f ~/.config/pulse/*-device-volumes.tdb

# 3. Restart PulseAudio to pick up clean state
echo "Restarting PulseAudio..."
pulseaudio --kill 2>/dev/null || true
sleep 1
pulseaudio --start --exit-idle-time=-1

echo "=== Done. Now restart both agents. ==="
echo "Each agent's start.sh will create exactly 1 sink and set PULSE_SINK."
