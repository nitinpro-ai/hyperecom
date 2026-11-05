# ApnaCity on Kubernetes

**Status: scaffold (D-016 — deployment target is Kubernetes).**
A dedicated build/test server will be provided by the owner; these manifests are
finalized once cluster details are known (see "Open items" below).

## Layout

```
infrastructure/kubernetes/
├── README.md            ← this file
├── base/
│   └── namespace.yaml   ← `apnacity` namespace
└── apps/
    ├── api.yaml         ← Deployment + Service (probes /v1/health) + HPA
    ├── web.yaml         ← Deployment + Service (Next.js standalone)
    └── (seller-portal / admin-portal follow web.yaml — same pattern, image/port swapped)
ingress.yaml             ← nginx-ingress host routing + cert-manager TLS (placeholder)
```

## Image builds (repo root context)

```bash
docker build -f apps/api/Dockerfile          -t ghcr.io/nitinpro-ai/hyperecom-api:latest .
docker build -f apps/web/Dockerfile          -t ghcr.io/nitinpro-ai/hyperecom-web:latest .
docker build -f apps/seller-portal/Dockerfile -t ghcr.io/nitinpro-ai/hyperecom-seller:latest .
docker build -f apps/admin-portal/Dockerfile  -t ghcr.io/nitinpro-ai/hyperecom-admin:latest .
```

CI (Step 3) builds and pushes these to the container registry on every tag.

## Host routing (once DNS + TLS are set)

| Host | Service |
|------|---------|
| `apnacity.com`, `www.`, `*.apnacity.com` (marketplace/city/shop) | `web` |
| `seller.apnacity.com` | `seller-portal` |
| `admin.apnacity.com` | `admin-portal` |
| `api.apnacity.com` | `api` |

Wildcard DNS `*.apnacity.com` → ingress IP; TLS via cert-manager (single
`*.apnacity.com` wildcard cert, DNS-01) — matches decision D-009.

## Environment & secrets

All app env vars (see `.env.example`) are injected via a Kubernetes `Secret`
(`apnacity-env`) + `ConfigMap` (`apnacity-config`) — never baked into images.
Create with: `kubectl -n apnacity create secret generic apnacity-env --from-env-file=.env`

## Open items — status (assessed 2026-11-05 against the homelab cluster)

1. **Cluster type/access:** ✅ MicroK8s 1.31 single node (`ubuntu-test`, 192.168.2.224,
   16 CPU / ~63 GB RAM / ~97 GB disk; kubeconfig at `~/work/homelab/kubeconfig/ubuntu-test.yaml`).
   Other projects (astrology/simlab/xlienlabs) run in separate namespaces — untouched.
2. **Container registry:** ✅ **GHCR** (no local registry needed; CI pushes, kubelet pulls
   via imagePullSecret).
3. **Postgres + Redis:** ✅ in-cluster for dev — `postgis/postgis:16-3.4` StatefulSet +
   PVC on `microk8s-hostpath` (default StorageClass, proven by other projects);
   nightly `pg_dump` job mandatory (single node, no HA).
4. **Ingress controller + cert-manager:** ⚠️ none installed. **Recommended for dev:
   Cloudflare Tunnel** (pattern already running in this cluster — `*-tunnel` pods;
   TLS terminates at Cloudflare edge, no LAN exposure, no cert-manager needed).
   Alternative: `microk8s enable ingress` + cert-manager later.
5. **Node capacity:** ✅ ~4 % CPU / ~7 % RAM currently used — the full ApnaCity dev
   stack (~4–5 CPU, ~8–10 GB, ~10 pods incl. Postgres/Redis/MinIO) fits comfortably.
6. **Migrations strategy:** ✅ `prisma migrate deploy` as a pre-deploy Job.

## Setup commands still to run (on the VM, then we deploy)

```bash
# SSH to 192.168.2.224 (credentials in ~/work/homelab/cred.MD — never commit/echo)
sudo microk8s enable metrics-server   # required for the HPA in apps/api.yaml
sudo microk8s enable ingress          # optional if using Cloudflare Tunnel only
```

Exposure for dev: create a Cloudflare Tunnel (owner's CF account, `rudicooli.com`
pattern) routing e.g. `apnacity-dev.rudicooli.com` → `web.apnacity.svc.cluster.local:80`
and `apnacity-api-dev.rudicooli.com` → `api.apnacity.svc.cluster.local:80`.
`*.apnacity.com` wildcard DNS/TLS applies later for production (D-009).

> Note: SAP VPN blocks 192.168.2.x — deploy from the Mac only with VPN off,
> or let GitHub Actions deploy (runner is outside the LAN).


## Local development is unchanged

Docker Compose (repo root) remains the local dev stack; Kubernetes is for the
build/test server and production. See `DEVELOPMENT.md`.
