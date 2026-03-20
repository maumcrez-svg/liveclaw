FROM node:20-slim

# Install Chromium, Xvfb, FFmpeg, PulseAudio
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    xvfb \
    ffmpeg \
    pulseaudio \
    fonts-liberation \
    fonts-noto-color-emoji \
    dbus \
    && rm -rf /var/lib/apt/lists/* \
    && usermod -aG pulse,pulse-access root

WORKDIR /app

# Copy package files and install deps
COPY package.json tsconfig.json ./
RUN npm install --omit=dev

# Copy built dist + visual assets
COPY dist/ dist/
COPY src/visual/ src/visual/
COPY src/idol-frame/entity.yaml src/idol-frame/entity.yaml
# bridge.ts uses __dirname (dist/idol-frame/) to find entity.yaml
COPY src/idol-frame/entity.yaml dist/idol-frame/entity.yaml

# Default env
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV DISPLAY=:96
ENV RESOLUTION=1920x1080
ENV BROADCAST_PORT=8095
ENV PULSE_SERVER=unix:/tmp/pulse-socket

# Start script
COPY docker-start.sh /app/docker-start.sh
RUN chmod +x /app/docker-start.sh

CMD ["/app/docker-start.sh"]
