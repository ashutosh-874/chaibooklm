# Build context must be the repo root (this is a bun workspace monorepo —
# apps/server depends on packages/shared and the root prisma/ schema).
#   docker build -f apps/server/Dockerfile -t chaibooklm-server .
FROM oven/bun:1 AS base
WORKDIR /app

# Copy the whole workspace before installing — bun needs every workspace
# package.json present to resolve `workspace:*` dependencies correctly.
COPY . .

RUN bun install --frozen-lockfile
# Generates packages/shared/src/generated/prisma, which apps/server imports
# via @chaibooklm/shared — must run after install, before the app can start.
# `prisma generate` never connects to the DB, but prisma.config.ts eagerly
# resolves DATABASE_URL, so a placeholder is enough at build time; the real
# value is supplied at runtime by the deployment platform's env vars.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN bunx prisma generate

WORKDIR /app/apps/server
EXPOSE 8000
CMD ["bun", "src/index.ts"]
