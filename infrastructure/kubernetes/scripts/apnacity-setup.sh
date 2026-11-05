#!/bin/bash
# ApnaCity cluster setup — runs ON the VM (ubuntu@192.168.2.224).
# Usage: SUDO_PASS=<password> bash apnacity-setup.sh
# Idempotent: safe to re-run. Enables microk8s addons required by ApnaCity dev.
sudo_run() { printf '%s\n' "$SUDO_PASS" | sudo -S "$@"; }

echo "=== enabling metrics-server (HPA requirement) ==="
sudo_run microk8s enable metrics-server
echo "=== enabling ingress (LAN access) ==="
sudo_run microk8s enable ingress
echo "=== enabling community repo + registry (local image registry :32000) ==="
sudo_run microk8s enable community
sudo_run microk8s enable registry
echo "SETUP_DONE"
