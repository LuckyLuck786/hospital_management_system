# Build context must be the monorepo ROOT (see docker-compose.yml).
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/types/package.json packages/types/
COPY apps/frontend/package.json apps/frontend/
RUN pnpm install --frozen-lockfile

COPY packages/types packages/types
COPY apps/frontend apps/frontend
ENV NEXT_OUTPUT=standalone
RUN pnpm --filter @medcore/frontend build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Standalone output bundles the server + traced node_modules
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./.next/static
COPY --from=builder /app/apps/frontend/public ./public
EXPOSE 3000
# API_PROXY_TARGET points Next's /api rewrites at the api container (http://api:3001)
ENV PORT=3000
CMD ["node", "server.js"]
