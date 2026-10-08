# Build context must be the monorepo ROOT (see docker-compose.yml), because the
# backend depends on workspace packages (@medcore/types) and pnpm workspaces.
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app

# Layer-cache the dependency install
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/types/package.json packages/types/
COPY apps/backend/package.json apps/backend/
RUN pnpm install --frozen-lockfile

COPY packages/types packages/types
COPY apps/backend apps/backend
RUN pnpm --filter @medcore/backend build
# Ship only the backend's production dependencies (resolves the workspace deps)
RUN pnpm --filter @medcore/backend deploy --prod /out

FROM node:20-alpine AS runner
# prisma CLI is a devDependency, so install the exact version for migrate/generate
RUN corepack enable && pnpm add -g prisma@5.22.0
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /out .
COPY --from=builder /app/apps/backend/prisma ./prisma
RUN prisma generate
EXPOSE 3001
# Migrations are idempotent — safe to run on every boot
CMD ["sh", "-c", "prisma migrate deploy && node dist/main"]
