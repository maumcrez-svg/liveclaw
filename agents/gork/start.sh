#!/bin/bash
set -e

# Load .env
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

DISPLAY_NUM=:93
RES="${RESOLUTION:-720x720}"

echo "[GORK] Starting Xvfb on $DISPLAY_NUM at ${RES}x24..."
Xvfb $DISPLAY_NUM -screen 0 ${RES}x24 -ac +extension GLX +render -noreset &
sleep 1

echo "[GORK] Starting PulseAudio..."
pulseaudio --start --exit-idle-time=-1 2>/dev/null || true
pactl load-module module-null-sink sink_name=gork_voice sink_properties=device.description="GorkVoice" 2>/dev/null || true

export DISPLAY=$DISPLAY_NUM
export PULSE_SINK=gork_voice

echo "[GORK] Starting agent..."
node dist/index.js &
AGENT_PID=$!

# Wait for broadcast server to be ready
sleep 5

echo "[GORK] Starting FFmpeg capture → RTMP..."
STREAM_URL="${MEDIAMTX_RTMP_URL}/${STREAM_KEY}"

ffmpeg -f x11grab -draw_mouse 0 -framerate 30 -video_size $RES -i $DISPLAY_NUM \
       -f pulse -i gork_voice.monitor \
       -c:v libx264 -preset veryfast -tune zerolatency -b:v 1500k -maxrate 1500k -bufsize 3000k \
       -g 60 -keyint_min 60 \
       -c:a aac -b:a 128k -ar 44100 \
       -f flv "$STREAM_URL" &
FFMPEG_PID=$!

echo "[GORK] All systems go. just gorkin' it."

# Watchdog
cleanup() {
    echo "[GORK] Shutting down..."
    WATCHDOG=false
    kill $AGENT_PID $FFMPEG_PID 2>/dev/null
    exit 0
}
trap cleanup SIGTERM SIGINT

launch_ffmpeg() {
    ffmpeg -f x11grab -draw_mouse 0 -framerate 30 -video_size $RES -i $DISPLAY_NUM \
           -f pulse -i gork_voice.monitor \
           -c:v libx264 -preset veryfast -tune zerolatency -b:v 1500k -maxrate 1500k -bufsize 3000k \
           -g 60 -keyint_min 60 \
           -c:a aac -b:a 128k -ar 44100 \
           -f flv "$STREAM_URL" &
    FFMPEG_PID=$!
    echo "[GORK] FFmpeg started PID $FFMPEG_PID"
}

WATCHDOG=true
while $WATCHDOG; do
    if ! kill -0 $AGENT_PID 2>/dev/null; then
        echo "[GORK] Agent died!"
        kill $FFMPEG_PID 2>/dev/null
        exit 1
    fi
    if ! kill -0 $FFMPEG_PID 2>/dev/null; then
        echo "[GORK] FFmpeg died, restarting..."
        sleep 3
        launch_ffmpeg
    fi
    sleep 5
done
