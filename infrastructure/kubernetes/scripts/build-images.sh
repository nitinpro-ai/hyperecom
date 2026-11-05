#!/bin/bash
# Build & push ApnaCity images to the local microk8s registry (:32000).
# Runs ON THE VM (192.168.2.224 — has docker + internet).
# Usage: bash build-images.sh [repo-dir-on-vm]   (default /tmp/hyperecom)
set -euo pipefail

REG="192.168.2.224:32000"
DIR="${1:-/tmp/hyperecom}"

if [ ! -f "$DIR/pnpm-workspace.yaml" ]; then
  echo "❌ $DIR does not look like the hyperecom repo — rsync it first (see deploy-dev.sh)"
  exit 1
fi

cd "$DIR"
for APP in api web seller-portal admin-portal; do
  case "$APP" in
    api) IMAGE="hyperecom-api"; DOCKERFILE="apps/api/Dockerfile";;
    web) IMAGE="hyperecom-web"; DOCKERFILE="apps/web/Dockerfile";;
    seller-portal) IMAGE="hyperecom-seller"; DOCKERFILE="apps/seller-portal/Dockerfile";;
    admin-portal) IMAGE="hyperecom-admin"; DOCKERFILE="apps/admin-portal/Dockerfile";;
  esac
  echo "=== building $IMAGE ==="
  docker build -f "$DOCKERFILE" -t "$REG/$IMAGE:latest" .
  docker push "$REG/$IMAGE:latest"
done
echo "IMAGES_DONE"
