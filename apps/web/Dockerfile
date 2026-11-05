# ApnaCity web (marketplace + city + shop storefronts) — BUILD CONTEXT IS THE REPO ROOT:
#   docker build -f apps/web/Dockerfile -t ghcr.io/nitinpro-ai/hyperecom-web:latest .
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile --filter @apnacity/web... --ignore-scripts
RUN pnpm --filter @apnacity/web build

FROM node:22-alpine AS runner
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
# When apps/web/public is added later, also COPY it to ./apps/web/public.
CMD ["node", "apps/web/server.js"]
