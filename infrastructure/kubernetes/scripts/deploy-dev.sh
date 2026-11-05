#!/bin/bash
# Deploy the ApnaCity DEV stack to the homelab MicroK8s cluster (LAN-only, D-016).
# Runs FROM THE MAC. Prereqs: kubectl, sshpass, rsync; VPN must be OFF
# (SAP VPN blocks 192.168.2.x). Credentials: ~/work/homelab/cred.MD (never commit).
set -euo pipefail

CRED_FILE="${CRED_FILE:-$HOME/work/homelab/cred.MD}"
KUBECONFIG="${KUBECONFIG:-$HOME/work/homelab/kubeconfig/ubuntu-test.yaml}"
export KUBECONFIG
VM=192.168.2.224
REGISTRY=$VM:32000
REPO_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"   # hyperecom repo root

UPASS=$(awk '/# Ubuntu Test Machine/{f=1} f&&/^password:/{print $2; exit}' "$CRED_FILE")
SSHP="sshpass -p $UPASS"
SSH="$SSHP ssh -o StrictHostKeyChecking=accept-new ubuntu@$VM"

step() { echo; echo "──── $* ────"; }

step "1/6 cluster addons (idempotent — skip if already enabled)"
$SSH 'test -f /tmp/apnacity-setup.done 2>/dev/null || (SUDO_PASS="$0" bash /tmp/apnacity-setup.sh <<< "$(cat)" )' <<< "$UPASS" >/dev/null 2>&1 || \
  $SSH "SUDO_PASS='$UPASS' nohup bash /tmp/apnacity-setup.sh >/tmp/apnacity-setup.log 2>&1; touch /tmp/apnacity-setup.done; grep -q SETUP_DONE /tmp/apnacity-setup.log" || true
$SSH 'microk8s status | grep -E "metrics-server|ingress|registry" | head -5'

step "2/6 namespace + data services (postgres/postgis, redis, minio)"
kubectl apply -f "$REPO_DIR/infrastructure/kubernetes/base/namespace.yaml"
kubectl apply -f "$REPO_DIR/infrastructure/kubernetes/data/"

step "3/6 secrets (dev values from config/env-dev.env.example)"
kubectl -n apnacity delete secret apnacity-env --ignore-not-found
kubectl -n apnacity create secret generic apnacity-env \
  --from-env-file="$REPO_DIR/infrastructure/kubernetes/config/env-dev.env.example"

step "4/6 build & push images (on the VM, via the local registry)"
$SSHP rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude dist --exclude .turbo \
  "$REPO_DIR/" ubuntu@$VM:/tmp/hyperecom/
$SSH "bash /tmp/build-images.sh /tmp/hyperecom" || {
  $SSHP scp "$REPO_DIR/infrastructure/kubernetes/scripts/build-images.sh" ubuntu@$VM:/tmp/build-images.sh
  $SSH "bash /tmp/build-images.sh /tmp/hyperecom"
}

step "5/6 app deployments"
kubectl apply -f "$REPO_DIR/infrastructure/kubernetes/apps/"

step "6/6 wait for rollout + verify"
kubectl -n apnacity rollout status deploy/postgres-minio 2>/dev/null || true
kubectl -n apnacity rollout status statefulset/postgres --timeout=180s || true
kubectl -n apnacity rollout status deploy/redis --timeout=120s
kubectl -n apnacity rollout status deploy/minio --timeout=180s || true
for d in api web seller-portal admin-portal; do
  kubectl -n apnacity rollout status deploy/$d --timeout=240s || echo "⚠️ $d not ready — check: kubectl -n apnacity get pods"
done

# MinIO buckets (idempotent)
kubectl -n apnacity exec deploy/minio -- sh -c \
  'mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD >/dev/null 2>&1; mc mb --ignore-existing local/apnacity-media; mc mb --ignore-existing local/apnacity-docs' || true

echo
echo "✅ DEV STACK DEPLOYED — LAN URLs:"
echo "   web      http://$VM:30280"
echo "   seller   http://$VM:30281"
echo "   admin    http://$VM:30282"
echo "   api      http://$VM:30400/v1/health"
echo "   postgres $VM:30432 (user/pass: apnacity/apnacity — DEV ONLY)"
echo "   minio    http://$VM:30900 (console :30901, apnacity/apnacity-secret)"
