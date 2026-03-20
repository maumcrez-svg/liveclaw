#!/bin/bash

echo "=== BASE PULSE CONTAINER ==="

# Create data dir
mkdir -p /app/data

# Start D-Bus (required by PulseAudio)
mkdir -p /run/dbus
dbus-daemon --system --fork 2>/dev/null || true

# Start PulseAudio properly inside container
export XDG_RUNTIME_DIR=/tmp/runtime
mkdir -p $XDG_RUNTIME_DIR

# Start PulseAudio in system mode (runs as 'pulse' user, root accesses via group)
pulseaudio --kill 2>/dev/null || true
sleep 1
pulseaudio --system --disallow-exit --exit-idle-time=-1 --daemonize=yes 2>/dev/null
sleep 2

# Connect via system socket
export PULSE_SERVER=unix:/run/pulse/native

# Create virtual audio sink
AUDIO_INPUT="-f lavfi -i anullsrc=r=44100:cl=stereo"
for attempt in 1 2 3 4 5; do
  if pactl info > /dev/null 2>&1; then
    pactl load-module module-null-sink sink_name=basepulse_voice sink_properties=device.description="BasePulse" 2>/dev/null
    pactl set-default-sink basepulse_voice 2>/dev/null
    export PULSE_SINK=basepulse_voice
    if pactl list short sinks 2>/dev/null | grep -q basepulse_voice; then
      echo "[OK] PulseAudio sink: basepulse_voice (attempt $attempt)"
      AUDIO_INPUT="-f pulse -i basepulse_voice.monitor"
      break
    fi
  fi
  echo "[RETRY] PulseAudio not ready, attempt $attempt/5..."
  sleep 2
done

if echo "$AUDIO_INPUT" | grep -q anullsrc; then
  echo "[WARN] PulseAudio failed — using silent audio fallback"
fi

# Start Xvfb
Xvfb $DISPLAY -screen 0 ${RESOLUTION}x24 -ac +extension GLX +render -noreset &
sleep 1
echo "[OK] Xvfb on $DISPLAY"

# Start the agent (Node.js)
node dist/index.js run &
NODE_PID=$!
echo "[OK] Agent started (PID $NODE_PID)"

# Wait for broadcast server
for i in $(seq 1 15); do
  curl -s http://localhost:$BROADCAST_PORT > /dev/null 2>&1 && break
  sleep 1
done
echo "[OK] Broadcast server on :$BROADCAST_PORT"

# Wait for Chromium to render first frame
sleep 5

# Start FFmpeg — capture Xvfb + audio → RTMP
STREAM_URL="${MEDIAMTX_RTMP_URL}/${STREAM_KEY}"
echo "[FFmpeg] Streaming to $MEDIAMTX_RTMP_URL"
echo "[FFmpeg] Audio: $AUDIO_INPUT"

ffmpeg \
  -f x11grab -framerate 30 -video_size $RESOLUTION -i $DISPLAY \
  $AUDIO_INPUT \
  -c:v libx264 -preset veryfast -tune zerolatency -b:v 4500k -maxrate 5000k -bufsize 10000k \
  -g 60 -keyint_min 60 \
  -c:a aac -b:a 160k -ar 44100 \
  -f flv "$STREAM_URL" &
FFMPEG_PID=$!
echo "[OK] FFmpeg started (PID $FFMPEG_PID)"

# Keep container alive — monitor and restart if needed
while true; do
  # Restart Node if it dies
  if ! kill -0 $NODE_PID 2>/dev/null; then
    echo "[WARN] Node died, restarting..."
    node dist/index.js run &
    NODE_PID=$!
  fi
  # Restart FFmpeg if it dies
  if ! kill -0 $FFMPEG_PID 2>/dev/null; then
    echo "[WARN] FFmpeg died, restarting..."
    sleep 3
    ffmpeg \
      -f x11grab -framerate 30 -video_size $RESOLUTION -i $DISPLAY \
      $AUDIO_INPUT \
      -c:v libx264 -preset veryfast -tune zerolatency -b:v 4500k -maxrate 5000k -bufsize 10000k \
      -g 60 -keyint_min 60 \
      -c:a aac -b:a 160k -ar 44100 \
      -f flv "$STREAM_URL" &
    FFMPEG_PID=$!
  fi
  sleep 30
done
