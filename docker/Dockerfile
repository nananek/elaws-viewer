# syntax=docker/dockerfile:1.7

# -----------------------------------------------------------------------------
# Stage 1: install (full deps incl. dev) + native build (glibc, with toolchain)
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

# Forward build SHA so vite `define` embeds the same X-App-Version that the
# server emits via the version-handshake middleware.
ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION:-dev}

RUN pnpm --filter @elaws/web run build
RUN pnpm --filter @elaws/server run build

# -----------------------------------------------------------------------------
# Stage 3: prod-only install — server + shared, no dev, no web runtime deps
# -----------------------------------------------------------------------------
FROM node:22-bookworm AS prod-deps

# Native build toolchain still required in case prod install rebuilds realm /
# better-sqlite3 from source (e.g. when prebuilds don't match the base image).
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.3.0 --activate

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/
COPY shared/package.json ./shared/

# --prod drops devDependencies; `--filter '@elaws/server...'` scopes the
# install to server + its workspace deps (i.e. shared) so web's huge dev
# tree (react / vite / tailwind / playwright / vitest / typescript) never
# touches this image.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter '@elaws/server...'

# realm 20.x packages prebuilt native libs for android (~556 MB), apple
# (~95 MB) and node (~15 MB). Only the `node` slice runs on the server, so
# the other two go straight to the bin.
RUN find node_modules -path '*/realm/prebuilds/android' -prune -exec rm -rf {} + \
 && find node_modules -path '*/realm/prebuilds/apple'   -prune -exec rm -rf {} +

# -----------------------------------------------------------------------------
# Stage 4: production runtime
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

# curl is only needed for the HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Per-COPY --chown avoids a final `chown -R /app` that would otherwise
# duplicate every byte of node_modules into a second image layer.
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/server/node_modules ./server/node_modules
COPY --from=prod-deps --chown=node:node /app/shared/node_modules ./shared/node_modules

# Manifests + build output. shared/src is shipped because @elaws/shared's
# `exports` map points to .ts files and Node 22's type-strip handles them
# at runtime.
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build --chown=node:node /app/server/package.json ./server/package.json
COPY --from=build --chown=node:node /app/server/dist ./server/dist
COPY --from=build --chown=node:node /app/shared/package.json ./shared/package.json
COPY --from=build --chown=node:node /app/shared/src ./shared/src

# Static web assets served by the server
COPY --from=build --chown=node:node /app/web/dist ./web/dist

# Storage volume mount point (small; only this subtree needs chown)
RUN install -d -o node -g node /app/storage

USER node

ARG APP_VERSION
ENV NODE_ENV=production \
    TZ=Asia/Tokyo \
    HOST=0.0.0.0 \
    PORT=3000 \
    APP_VERSION=${APP_VERSION:-dev}

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

CMD ["node", "server/dist/index.js"]
