# ✦ OMNIVERSE — Production 24/7 Cloud Container ✦
FROM node:20-alpine

# Install FFmpeg, Python3, and the latest yt-dlp binary
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Copy runtime code and static frontend assets
COPY desktop ./desktop
COPY shared ./shared

# Configuration
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=10000

EXPOSE 10000

# Start unified high-speed media server
CMD ["node", "desktop/server.js"]
