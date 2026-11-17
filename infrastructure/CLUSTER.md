# ApnaCity Infrastructure State (CLUSTER.md)

> **DURABLE MEMORY — read this before touching the cluster.** Any session (any
> model/agent/human) must treat this file as the source of truth for the dev
> environment. Update it after every infrastructure change + commit.
> Last updated: 2026-11-17 · **Status: COMPLETE CLICKABLE DEV SITE LIVE ✅** — all 32 modules + full customer UI (home/login/search/cart/checkout/orders) + seller portal (register/KYC/shop/product-upload) deployed. End-to-end purchase verified live: OTP login→search→PDP→cart→checkout→order (APN-2026-000017). Rich seed: 6 categories, 8 shops, 26 products.

## Deploy gotchas learned 2026-11-16 (MUST avoid next time)

1. **`*.tsbuildinfo` must be excluded from the rsync to the VM** (now in deploy-dev.sh).
   If it travels, `tsc --incremental` on the VM emits NOTHING → no `dist/main.js` →
   api pod `MODULE_NOT_FOUND` crashloop. (The `.dockerignore` only helps if building
   from the repo; the rsync path needed its own exclude.)
2. **Images use `:latest` + `imagePullPolicy: Always`.** `kubectl apply` sees no spec
   change → no rollout. After pushing new images you MUST
   `kubectl -n apnacity rollout restart deploy/api deploy/web deploy/seller-portal deploy/admin-portal`.
3. **Compiled build is stricter than `tsx` for NestJS DI.** Interface-typed or
   defaulted constructor params crash the compiled app (`Nest can't resolve ...`).
   Guard against it with the **boot test** `apps/api/src/app.boot.spec.ts`
   (`Test.createTestingModule(AppModule).compile()`) — run it before every deploy;
   it reproduces DI errors locally in ~1s instead of in a crashlooping pod.
4. Env var names: the cluster secret + `packages/config` use `JWT_ACCESS_SECRET`,
   `REFRESH_SECRET`, `OTP_HASH_PEPPER` (not `JWT_SECRET`/`AUTH_PEPPER`). Media disk
   driver vars added to `config/env-dev.env.example`.
5. **After a build, check the pushed image DIGEST changed.** If a rebuild returns the
   *same* `sha256:` digest as the prior build, the source on the VM did NOT change —
   the rsync silently failed (e.g. wrong `sshpass` path in an ad-hoc command) and you
   built stale source → old UI/behaviour ships. ALWAYS verify a redesign file is on the
   VM (`ssh … 'test -f /tmp/hyperecom/apps/web/src/components/ui.tsx'`) before building,
   and confirm the digest differs after. Use `deploy-dev.sh` (has `set -euo pipefail`)
   rather than hand-rolled rsync/ssh lines.

## Cluster (dev/test — D-016)

| Property | Value |
|---|---|
| Type | MicroK8s **1.31** single node (dev-grade, no HA) |
| Node / VM | `ubuntu-test` @ **192.168.2.224** (Ubuntu 24.04, XCP-ng VM on 192.168.2.170) |
| Capacity | 16 CPU · ~63 GB RAM · ~97 GB disk |
| kubeconfig | `~/work/homelab/kubeconfig/ubuntu-test.yaml` (context `microk8s`, admin) |
| SSH | `sshpass -p <pass> ssh ubuntu@192.168.2.224` — credentials in `~/work/homelab/cred.MD` (Ubuntu Test Machine). **Never commit/echo credential values.** |
| Addons | dns · hostpath-storage · **metrics-server** · **ingress** · **community** · **registry** (20Gi @ :32000) |
| Registry gotcha ⚠️ | k8s manifests must reference images as **`localhost:32000/...`** (microk8s containerd only trusts localhost). The VM's docker daemon trusts `192.168.2.224:32000` (configured by `scripts/fix-docker-registry.sh`) for build+push. |
| Other tenants | namespaces `astrology`, `simlab`, `xlienlabs` (NOT ours — never touch) |
| ⚠️ VPN | SAP VPN blocks 192.168.2.x — cluster ops from the Mac require VPN OFF |
| Backups | Single node, no HA — **nightly `pg_dump` of the apnacity DB is mandatory** (not yet automated — Tracking §7) |

## Deployed in namespace `apnacity` — VERIFIED 2026-11-05

| Component | Kind | Image | LAN access | Status |
|---|---|---|---|---|
| postgres+postgis | StatefulSet (PVC 20Gi) | postgis/postgis:16-3.4 | `192.168.2.224:30432` (apnacity/apnacity — DEV ONLY) | ✅ Running · **postgis 3.4 + pg_trgm enabled** |
| redis | Deployment (PVC 2Gi, AOF) | redis:7-alpine | internal `redis.apnacity.svc` | ✅ Running |
| minio | Deployment — **scaled to 0 (DEFERRED)** | — | `:30900` / console `:30901` | ⏸ Docker Hub rate-limited on this IP; not needed until Step 5 (M10 media). Retry later or `docker login`. |
| api ×2 (+HPA) | Deployment | `localhost:32000/hyperecom-api:latest` | `http://192.168.2.224:30400/v1/health` | ✅ **health OK** |
| web ×2 | Deployment | `localhost:32000/hyperecom-web:latest` | `http://192.168.2.224:30280` | ✅ 200 |
| seller-portal | Deployment | `localhost:32000/hyperecom-seller:latest` | `http://192.168.2.224:30281` | ✅ 200 |
| admin-portal | Deployment | `localhost:32000/hyperecom-admin:latest` | `http://192.168.2.224:30282` | ✅ 200 |
| secret | `apnacity-env` | from `config/env-dev.env.example` (incl. `PORT=4000`) | — | ✅ |

## Hard-won gotchas (any future session MUST know)

1. **Images:** build+push on the VM via `scripts/build-images.sh` (rsync repo → VM first).
   Manifests reference `localhost:32000/...`; docker push targets `192.168.2.224:32000/...`.
2. **pnpm 12:** hard-fails dep build-scripts in Docker (`ERR_PNPM_IGNORED_BUILDS`) →
   all Dockerfile installs use `--ignore-scripts`; prisma generate runs explicitly.
3. **`*.tsbuildinfo` must never enter the Docker context** (tsc incremental then skips
   emit silently!) — excluded in `.dockerignore` + `.gitignore`.
4. **API container port:** driven by `PORT` env (4000), never by `API_BASE_URL`
   (external URL carries the NodePort 30400).
5. **Dockerfile build context = repo root** and must COPY `tsconfig.base.json`.
6. **NodePorts:** ours = 30280/30281/30282/30400/30432/30900-1. Ports 30080/30081
   and 30300/30850 belong to other tenants — always check before allocating.

## Day-2 operations (exact commands)

```bash
export KUBECONFIG=~/work/homelab/kubeconfig/ubuntu-test.yaml

# full redeploy (rsync → build on VM → push → apply → verify)
bash infrastructure/kubernetes/scripts/deploy-dev.sh

# quick app restart after an image rebuild
kubectl -n apnacity rollout restart deploy/api deploy/web deploy/seller-portal deploy/admin-portal

# logs / status
kubectl -n apnacity get pods && kubectl -n apnacity logs deploy/api --tail=100

# run prisma migrations from the Mac against the cluster DB (Step 2+)
DATABASE_URL=postgresql://apnacity:apnacity@192.168.2.224:30432/apnacity pnpm --filter @apnacity/db migrate:dev

# verify gate (LAN)
curl http://192.168.2.224:30400/v1/health    # {"status":"ok",...}
curl -o /dev/null -w '%{http_code}\n' http://192.168.2.224:30280   # 200
```

## Media storage (M10) — driver toggle

Media (product images, logos, KYC docs, PoD) is backed by a **pluggable storage
driver** selected by `MEDIA_STORAGE_DRIVER` (see `packages/config` + `.env.example`
"MEDIA / STORAGE" block). **No S3 or MinIO is required for dev.**

| Driver | When | Needs |
|---|---|---|
| `disk` (default) | dev + cluster now | `MEDIA_DISK_ROOT` (point at a **mounted PVC** in the cluster so files persist), `MEDIA_PUBLIC_BASE_URL`, `MEDIA_SIGN_SECRET` |
| `s3` | staging/prod | `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_PUBLIC`, `S3_BUCKET_PRIVATE`, `S3_FORCE_PATH_STYLE`, `CDN_BASE_URL` — app refuses to boot if any missing |

**MinIO status:** the `minio` Deployment is scaled to **0** — `minio/minio:latest`
is unpullable on this node (Docker Hub rate-limit → `ErrImagePull`, pull returns HTML).
Dev is **unblocked** via the disk driver. To enable S3 later, EITHER:
- mirror a MinIO image into the local registry (`localhost:32000`, see Images gotcha) or `docker login` on the VM, scale minio to 1, then set `MEDIA_STORAGE_DRIVER=s3` + the S3_* values pointing at `minio.apnacity.svc:9000`; OR
- use **Cloudflare R2** (no cluster image needed): `S3_ENDPOINT=https://<acct>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_FORCE_PATH_STYLE=true`.

**Prod DB role:** the API must connect as a **non-superuser** Postgres role — `apnacity`
is a SUPERUSER and bypasses RLS (tenant isolation won't apply). Create a dedicated
app role (verified working as `app_rls`) before real tenant data.

## Exposure

**Dev = LAN-only** (owner decision: **no Cloudflare tunnel initially** — test from the
home network via the NodePort URLs above). Ingress addon installed but unused.
Production later: `*.apnacity.com` wildcard → ingress + cert-manager, or CF Tunnel.

## Security notes

Dev credentials are weak/DEV-ONLY (postgres/minio/VM) — fine on the LAN, **never
expose beyond it**; rotate before internet exposure. GitHub PAT (old planning
folder `gitrepo/info.md`) needs rotation. Kubeconfig = cluster-admin: treat as secret.
