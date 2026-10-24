# Multi-stage Docker build for Next.js Frontend
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace configurations and lockfile
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/

# Configure npm retries for resilient network fetching inside Docker
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-factor 2 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-retry-maxtimeout 60000 && \
    npm install --workspace=shared --workspace=frontend

# Copy source code
COPY shared/ ./shared/
COPY frontend/ ./frontend/

# Build shared library first
RUN npm run build --workspace=shared

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=frontend

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy necessary build artifacts (npm workspaces hoists to root node_modules)
COPY --from=builder /app/package.json ./
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/frontend/package.json ./frontend/
COPY --from=builder /app/frontend/.next ./frontend/.next
COPY --from=builder /app/frontend/public ./frontend/public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=frontend"]
