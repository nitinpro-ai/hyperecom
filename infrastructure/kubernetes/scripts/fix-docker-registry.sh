#!/bin/bash
# Fix Docker daemon on the VM: trust the local microk8s registry (:32000).
# Usage: SUDO_PASS=<password> bash fix-docker-registry.sh
set -e
sudo_run() { printf '%s\n' "$SUDO_PASS" | sudo -S "$@"; }
# Overwrite any previous (possibly corrupt) daemon.json with clean JSON:
printf '%s\n' '{"insecure-registries":["192.168.2.224:32000"]}' > /tmp/daemon.json.new
sudo_run cp /tmp/daemon.json.new /etc/docker/daemon.json
echo "--- daemon.json content: ---"
cat /etc/docker/daemon.json
sudo_run systemctl restart docker
sleep 4
echo "--- docker status: $(systemctl is-active docker) ---"
docker info 2>/dev/null | grep -A1 'Insecure Registries'
