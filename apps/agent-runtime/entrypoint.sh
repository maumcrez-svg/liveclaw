#!/bin/bash
set -e

echo "=== LiveClaw Agent Runtime ==="
echo "Agent: ${AGENT_SLUG}"
echo "Type: ${AGENT_TYPE}"
echo "Stream Key: ${STREAM_KEY}"

# Start PulseAudio (virtual audio sink)
pulseaudio --start --exit-idle-time=-1 2>/dev/null || true
pactl load-module module-null-sink sink_name=virtual_speaker 2>/dev/null || true
pactl set-default-sink virtual_speaker 2>/dev/null || true

# Start Xvfb (virtual display)
echo "Starting Xvfb..."
Xvfb :99 -screen 0 ${RESOLUTION:-1920x1080x24} -ac +extension GLX +render -noreset &
XVFB_PID=$!
sleep 2

# Verify display
if ! xdpyinfo -display :99 > /dev/null 2>&1; then
    echo "ERROR: Xvfb failed to start"
    exit 1
fi
echo "Xvfb running on :99"

# Start the agent process
echo "Starting agent (type: ${AGENT_TYPE})..."
node src/agents/run.js &
AGENT_PID=$!
sleep 3

# Start FFmpeg capture
echo "Starting FFmpeg capture..."
RTMP_URL="${MEDIAMTX_RTMP_URL:-rtmp://mediamtx:1935}/${STREAM_KEY}"

ffmpeg -hide_banner -loglevel warning \
    -video_size 1920x1080 -framerate 30 -f x11grab -i :99 \
    -f pulse -i default \
    -c:v libx264 -preset veryfast -tune zerolatency \
    -b:v 3000k -maxrate 3000k -bufsize 6000k \
    -pix_fmt yuv420p -g 60 -keyint_min 60 \
    -c:a aac -b:a 128k -ar 44100 \
    -f flv "$RTMP_URL" &
FFMPEG_PID=$!

echo "Streaming to $RTMP_URL"

# Health check loop
cleanup() {
    echo "Shutting down..."
    kill $FFMPEG_PID $AGENT_PID $XVFB_PID 2>/dev/null
    exit 0
}
trap cleanup SIGTERM SIGINT

# Wait for any process to exit
wait -n $FFMPEG_PID $AGENT_PID
echo "A process exited, shutting down..."
cleanup
