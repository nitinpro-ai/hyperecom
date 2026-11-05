# ApnaCity admin-portal — BUILD CONTEXT IS THE REPO ROOT:
#   docker build -f apps/admin-portal/Dockerfile -t ghcr.io/nitinpro-ai/hyperecom-admin:latest .
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/admin-portal ./apps/admin-portal
RUN pnpm install --frozen-lockfile --filter @apnacity/admin-portal...
RUN pnpm --filter @apnacity/admin-portal build

FROM node:22-alpine AS runner
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3002
WORKDIR /app
COPY --from=builder /app/apps/admin-portal/.next/standalone ./
COPY --from=builder /app/apps/admin-portal/.next/static ./apps/admin-portal/.next/static
EXPOSE 3002
CMD ["node", "apps/admin-portal/server.js"]
