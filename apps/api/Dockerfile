# ApnaCity API image — BUILD CONTEXT IS THE REPO ROOT:
#   docker build -f apps/api/Dockerfile -t ghcr.io/nitinpro-ai/hyperecom-api:latest .
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter @apnacity/api... --ignore-scripts
RUN pnpm --filter @apnacity/db generate
RUN pnpm --filter @apnacity/api build
FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
# Dev-grade image: copy the whole built workspace (pnpm symlink layout preserved).
# CI hardening (Step 3) may revisit pruning; dev cluster correctness > image size.
COPY --from=builder /app ./
EXPOSE 4000
# Env comes from Kubernetes Secret/ConfigMap (never baked into images).
CMD ["node", "apps/api/dist/main.js"]
