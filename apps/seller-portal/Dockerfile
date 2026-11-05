# ApnaCity seller-portal — BUILD CONTEXT IS THE REPO ROOT:
#   docker build -f apps/seller-portal/Dockerfile -t ghcr.io/nitinpro-ai/hyperecom-seller:latest .
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/seller-portal ./apps/seller-portal
RUN pnpm install --frozen-lockfile --filter @apnacity/seller-portal...
RUN pnpm --filter @apnacity/seller-portal build

FROM node:22-alpine AS runner
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3001
WORKDIR /app
COPY --from=builder /app/apps/seller-portal/.next/standalone ./
COPY --from=builder /app/apps/seller-portal/.next/static ./apps/seller-portal/.next/static
EXPOSE 3001
CMD ["node", "apps/seller-portal/server.js"]
