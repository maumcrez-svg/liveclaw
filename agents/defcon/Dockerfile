FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    xvfb \
    pulseaudio \
    ffmpeg \
    fonts-liberation \
    x11-utils \
    dbus \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc && npm prune --omit=dev

ENV CHROMIUM_PATH=/usr/bin/chromium
ENV NODE_ENV=production

COPY start.sh ./
RUN chmod +x start.sh

CMD ["./start.sh"]
