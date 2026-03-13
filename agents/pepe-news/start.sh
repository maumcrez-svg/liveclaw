#!/bin/bash
set -e

# Load .env if present
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

echo "=== PEPE NEWS Agent Startup ==="

DISPLAY=${DISPLAY:-:99}
RESOLUTION=${RESOLUTION:-1280x720}
STREAM_KEY=${STREAM_KEY:?STREAM_KEY must be set}
MEDIAMTX_RTMP_URL=${MEDIAMTX_RTMP_URL:-rtmp://localhost:1935}

export DISPLAY

# Start PulseAudio (virtual audio sink for TTS voice)
echo "[0/4] Starting PulseAudio..."
pulseaudio --start --exit-idle-time=-1 2>/dev/null || true

# Clean any duplicate pepe_voice sinks before creating a fresh one
for mod in $(pactl list short modules | grep pepe_voice | awk '{print $1}'); do
  pactl unload-module "$mod" 2>/dev/null || true
done

pactl load-module module-null-sink sink_name=pepe_voice \
  sink_properties=device.description="PepeVoice" rate=44100 2>/dev/null || true

# PULSE_SINK env var forces all child processes (Chromium) to this sink
# at the PulseAudio protocol level — no race condition, no stream-restore override
export PULSE_SINK=pepe_voice

echo "PulseAudio ready (PULSE_SINK=pepe_voice)"

# Start Xvfb (virtual display)
echo "[1/4] Starting Xvfb on $DISPLAY ($RESOLUTION)..."
Xvfb $DISPLAY -screen 0 "${RESOLUTION}x24" -ac +extension GLX +render -noreset &
XVFB_PID=$!
sleep 2

# Verify display
if ! xdpyinfo -display $DISPLAY > /dev/null 2>&1; then
    echo "ERROR: Xvfb failed to start"
    exit 1
fi
echo "Xvfb running on $DISPLAY"

# Start the PEPE NEWS agent
echo "[2/4] Starting PEPE NEWS agent..."
cd "$SCRIPT_DIR"
node dist/index.js &
AGENT_PID=$!
sleep 5

# Start FFmpeg capture (video from Xvfb + audio from PulseAudio)
echo "[3/4] Starting FFmpeg capture..."
RTMP_URL="${MEDIAMTX_RTMP_URL}/${STREAM_KEY}"

ffmpeg -hide_banner -loglevel warning \
    -video_size $RESOLUTION -framerate 30 -f x11grab -draw_mouse 0 -i $DISPLAY \
    -f pulse -i pepe_voice.monitor \
    -c:v libx264 -preset veryfast -tune zerolatency \
    -b:v 2500k -maxrate 2500k -bufsize 5000k \
    -pix_fmt yuv420p -g 60 \
    -c:a aac -b:a 128k -ar 44100 \
    -f flv "$RTMP_URL" &
FFMPEG_PID=$!

echo "Streaming to $RTMP_URL"
echo "=== PEPE NEWS is LIVE ==="

# Cleanup handler
cleanup() {
    echo "Shutting down PEPE NEWS..."
    kill $AGENT_PID 2>/dev/null
    sleep 2
    kill $FFMPEG_PID $XVFB_PID 2>/dev/null
    exit 0
}
trap cleanup SIGTERM SIGINT

# Wait for any process to exit
wait -n $FFMPEG_PID $AGENT_PID 2>/dev/null
echo "A process exited, shutting down..."
cleanup
