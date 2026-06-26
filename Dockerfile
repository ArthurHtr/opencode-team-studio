# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: Dependencies — resolve production dependencies
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json .npmrc ./

RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# Stage 2: Builder — compile the application
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: Runner — minimal production image
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV HOME=/tmp

RUN groupadd -r appuser && \
    useradd -r -g appuser -d /app -s /sbin/nologin appuser

COPY --from=builder /app/public ./public
COPY --from=builder --chown=appuser:appuser /app/.next/standalone ./
COPY --from=builder --chown=appuser:appuser /app/.next/static ./.next/static

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', r => { const c=[]; r.on('data',d=>c.push(d)); r.on('end',()=>{ process.exit(c.join('')===JSON.stringify({status:'ok'})?0:1) }) }).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
