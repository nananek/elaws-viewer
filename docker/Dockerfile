# syntax=docker/dockerfile:1.7

# -----------------------------------------------------------------------------
# Stage 1: install + native build (glibc, with toolchain)
# -----------------------------------------------------------------------------
FROM node:22-bookworm AS deps

# realm and better-sqlite3 build natively if no prebuild matches the runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.3.0 --activate

WORKDIR /app

# Copy lockfiles first for cache layer
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/
COPY shared/package.json ./shared/

# Native build approvals live in pnpm-workspace.yaml (allowBuilds:)
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: build server and web
# -----------------------------------------------------------------------------
FROM deps AS build

COPY shared/ ./shared/
COPY server/ ./server/
COPY web/ ./web/

RUN pnpm --filter @elaws/web run build
RUN pnpm --filter @elaws/server run build

# -----------------------------------------------------------------------------
# Stage 3: production runtime (glibc; small)
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

# Need curl for the docker-compose healthcheck only
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed deps (already built natively for glibc)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/shared/node_modules ./shared/node_modules

# Source / build output
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/src ./shared/src

# Static web assets, served by the server
COPY --from=build /app/web/dist ./web/dist

# Storage is a volume; create the mount point owned by `node`
RUN mkdir -p /app/storage && chown -R node:node /app

USER node

ENV NODE_ENV=production \
    TZ=Asia/Tokyo \
    HOST=0.0.0.0 \
    PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

CMD ["node", "server/dist/index.js"]
