# ApnaCity API image — BUILD CONTEXT IS THE REPO ROOT:
#   docker build -f apps/api/Dockerfile -t ghcr.io/nitinpro-ai/hyperecom-api:latest .
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter @apnacity/api...
RUN pnpm --filter @apnacity/db generate
RUN pnpm --filter @apnacity/api build
# Prune to production dependencies only (api + its workspace deps)
RUN pnpm --filter @apnacity/api deploy --prod /out

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /out ./
EXPOSE 4000
# Env comes from Kubernetes Secret/ConfigMap (never baked into images).
CMD ["node", "dist/main.js"]
