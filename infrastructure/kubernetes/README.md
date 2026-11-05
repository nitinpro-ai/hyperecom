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

## Open items — needed from the owner when the server is shared

1. **Cluster type/access:** kubeconfig or SSH + is it k3s / managed (EKS/GKE/AKS) / other?
2. **Container registry:** GHCR (GitHub) or private registry on the server?
3. **Postgres + Redis:** run in-cluster (StatefulSets + PVC, needs a StorageClass)
   or managed/external? PostGIS image required either way.
4. **Ingress controller + cert-manager:** already installed? Cluster-issuer email?
5. **Node capacity:** CPU/RAM of the server (sizing for requests/limits + HPA).
6. **Migrations strategy:** confirmed `prisma migrate deploy` as a pre-deploy Job.

## Local development is unchanged

Docker Compose (repo root) remains the local dev stack; Kubernetes is for the
build/test server and production. See `DEVELOPMENT.md`.
