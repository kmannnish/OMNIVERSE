# Multi-stage Docker build for Media API and Worker
FROM node:22-alpine AS base

# Install system dependencies including FFmpeg, FFprobe, yt-dlp, and Python3
RUN apk add --no-cache \
    ffmpeg \
    yt-dlp \
    python3 \
    ca-certificates \
    tzdata

WORKDIR /app

# Copy root workspace configurations and lockfile
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

# Configure npm retries for resilient network fetching inside Docker
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-factor 2 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-retry-maxtimeout 60000 && \
    npm install --workspace=shared --workspace=backend

# Copy source code
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build shared library first
RUN npm run build --workspace=shared

# Build backend TypeScript
RUN npm run build --workspace=backend

# Scratch directory setup
RUN mkdir -p /tmp/media-scratch && chmod 777 /tmp/media-scratch

ENV NODE_ENV=production
ENV SCRATCH_DIR=/tmp/media-scratch

EXPOSE 4000

# Default command (overridden in docker-compose for worker)
CMD ["node", "backend/dist/server.js"]
