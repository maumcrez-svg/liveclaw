FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99
ENV RESOLUTION=1920x1080x24

# System packages
RUN apt-get update && apt-get install -y \
    xvfb \
    ffmpeg \
    pulseaudio \
    chromium-browser \
    python3 \
    python3-pip \
    nodejs \
    npm \
    curl \
    wget \
    x11-utils \
    xdotool \
    imagemagick \
    fonts-liberation \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Install newer Node.js
RUN npm install -g n && n 20 && npm install -g pnpm

# Python packages for creative agents
RUN pip3 install --no-cache-dir \
    Pillow \
    numpy \
    moviepy \
    requests

# App setup
WORKDIR /app
COPY package.json ./
RUN npm install
COPY src/ ./src/
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
