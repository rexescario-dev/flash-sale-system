# syntax=docker/dockerfile:1
# #118 full local Compose stack.
# Packaging decision (Task 0): host/store `pnpm deploy` is fragile on pnpm 10
# (requires --legacy; omits Nest/Vite `dist` without package `files`).
# Use workspace-copy into /out/* so compiled artifacts + pnpm symlink graph remain intact.
# Migrate may carry the full deps tree (minimization out of scope).

FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY e2e/package.json e2e/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN pnpm install --frozen-lockfile

# migrate: full deps accepted for local Compose simplicity
FROM deps AS migrate
COPY apps/api/prisma apps/api/prisma
COPY apps/api/package.json apps/api/package.json
WORKDIR /app
CMD ["pnpm", "--filter", "api", "prisma:migrate:deploy"]

FROM deps AS build-api
COPY packages/typescript-config packages/typescript-config
COPY packages/domain packages/domain
COPY apps/api apps/api
RUN pnpm --filter @flash-sale/domain build \
  && pnpm --filter api build \
  && mkdir -p /out/api \
  && cp -a /app/. /out/api/

FROM base AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build-api /out/api/ ./
HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]

FROM deps AS build-web
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
COPY packages/typescript-config packages/typescript-config
COPY apps/web apps/web
RUN pnpm --filter web build \
  && mkdir -p /out/web \
  && cp -a /app/. /out/web/

FROM base AS web
# Workspace-copy keeps Vite under apps/web; preview must run from that package root
# so it finds apps/web/dist (not /app/dist).
WORKDIR /app/apps/web
COPY --from=build-web /out/web/ /app/
EXPOSE 5173
# Prefer direct vite binary (pnpm is a build-time tool only)
CMD ["./node_modules/.bin/vite", "preview", "--host", "0.0.0.0", "--port", "5173"]
