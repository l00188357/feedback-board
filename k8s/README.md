# Kubernetes Deployment — Feedback Board

This directory defines the **application** Kubernetes resources for Feedback Board. The project uses a local **Kind (Kubernetes in Docker)** cluster with two application Services: an Astro frontend served by Nginx and a PocketBase backend with persistent SQLite storage. Monitoring is configured separately in [`../monitoring/`](../monitoring/README.md).

## Architecture

```text
Kind cluster: feedback-board

Namespace: feedback-board
  Browser -- port-forward :8081 --> frontend Service :80
                                    |
                                 Nginx + Astro
                                    | /api/*
                                    v
                               backend Service :8090
                                    |
                                 PocketBase
                                    |
                         PVC pocketbase-data (1 GiB)
                                    |
                                 SQLite

Namespace: monitoring (optional application monitoring)
  Blackbox Exporter --> Prometheus --> Grafana
```

The frontend and backend Services are **ClusterIP**, not public load balancers. Nginx proxies `/api/` to `http://backend:8090` inside the application's namespace.

## Manifests

| File | Description |
|---|---|
| `namespace.yaml` | Creates namespace `feedback-board` |
| `backend-pvc.yaml` | Requests `pocketbase-data`, 1 GiB persistent storage |
| `backend-deployment.yaml` | One PocketBase replica, `Recreate` strategy, `/api/health` probes and PVC mount |
| `backend-service.yaml` | Internal PocketBase Service, port 8090 |
| `frontend-deployment.yaml` | One Astro/Nginx replica with `/` readiness/liveness probes |
| `frontend-service.yaml` | Internal frontend Service, port 80 |

## Prerequisites

Install Docker Desktop (Linux containers), `kind`, `kubectl` and Docker CLI. Use Node.js **22.23.4+** for the smoke-test script. All commands below use **PowerShell** and run from the repository root.

## 1. Create or reuse the Kind cluster

```powershell
kind get clusters
```

If `feedback-board` does not appear, create it:

```powershell
kind create cluster --name feedback-board --wait 120s
```

Verify the node is ready:

```powershell
kubectl cluster-info
kubectl get nodes
```

## 2. Build and load images

Kind cannot automatically use images from the host's Docker image store; load them into the Kind cluster:

```powershell
docker build -t feedback-board-backend:dev ./backend
docker build -t feedback-board-frontend:dev ./frontend
kind load docker-image feedback-board-backend:dev --name feedback-board
kind load docker-image feedback-board-frontend:dev --name feedback-board
```

These image names match `backend-deployment.yaml` and `frontend-deployment.yaml` (both use `imagePullPolicy: IfNotPresent`).

## 3. Apply Kubernetes resources

Apply namespace and storage **before** the Deployments:

```powershell
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/backend-pvc.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
```

Wait until both Deployments are ready:

```powershell
kubectl rollout status deployment/backend -n feedback-board --timeout=180s
kubectl rollout status deployment/frontend -n feedback-board --timeout=180s
```

Confirm resources:

```powershell
kubectl get pods -n feedback-board
kubectl get services -n feedback-board
kubectl get pvc -n feedback-board
```

Expect both application Pods to show `1/1 Running` and the `pocketbase-data` PVC to show `Bound`.

## 4. Access the application

Run this in one PowerShell terminal and leave it open:

```powershell
kubectl port-forward -n feedback-board service/frontend 8081:80
```

Open <http://localhost:8081> in a browser. Nginx forwards `/api/` requests to PocketBase internally. To access the backend API directly, start a second port-forward in another terminal:

```powershell
kubectl port-forward -n feedback-board service/backend 8091:8090
```

Check <http://localhost:8091/api/health> and <http://localhost:8091/api/collections/feedbacks/records>.

## 5. Run smoke tests

With the frontend port-forward active, execute from the repository root in **another** PowerShell terminal:

```powershell
$env:SMOKE_BASE_URL = "http://localhost:8081"
node scripts/smoke-test.mjs
Remove-Item Env:SMOKE_BASE_URL
```

The script checks the Astro page, PocketBase health through Nginx, and the public `feedbacks` records API. These checks are also executed in GitHub Actions, where the CD workflow creates an ephemeral Kind cluster.

## 6. SQLite data persistence

PocketBase stores SQLite files in `/pb/pb_data`, mounted from the **1 GiB PVC** called `pocketbase-data`. The backend uses **one replica** with `Recreate` updates to avoid concurrent writers using the same SQLite database.

Persistence across Pod replacement was verified locally:

1. Create a feedback record using the UI and confirm it appears in the list.
2. Delete only the backend Pod:

   ```powershell
   kubectl delete pod -n feedback-board -l app=backend
   ```

3. Wait for recovery:

   ```powershell
   kubectl rollout status deployment/backend -n feedback-board --timeout=180s
   ```

4. Refresh the UI or query the records endpoint and confirm the record remains.

**Important:** a Kind local PVC is not a backup. Deleting the entire Kind cluster may delete its underlying storage. Docker Compose and Kind use **different** SQLite storage; their records are not automatically synchronized.

## 7. Troubleshooting and diagnostics

```powershell
kubectl get pods -n feedback-board
kubectl get events -n feedback-board
kubectl describe deployment backend -n feedback-board
kubectl describe deployment frontend -n feedback-board
kubectl get pvc -n feedback-board
kubectl describe pvc pocketbase-data -n feedback-board
kubectl logs deployment/backend -n feedback-board --tail=100
kubectl logs deployment/frontend -n feedback-board --tail=100
```

If a Pod stays `Pending`, inspect its events and available node resources. If a local image cannot be found, confirm that `kind load docker-image` was run against the correct cluster. If a port-forward stops responding, check that its terminal is still running and the corresponding Service has healthy endpoints.

## 8. Monitoring and CI/CD

The monitoring stack is deployed to namespace `monitoring`, not `feedback-board`. It installs **Prometheus**, **Blackbox Exporter** and **Grafana** using version-controlled Helm values files. The CI/CD workflow `.github/workflows/cd.yml` provisions monitoring after application deployment and smoke testing, then verifies HTTP probes, dashboard and alert rules.

See [monitoring/README.md](../monitoring/README.md) for the manual Helm procedure and dashboard access. This repository uses **ephemeral Kind for CD validation**, not a permanent production cluster.

## 9. Cleanup

To stop the port-forward, press `Ctrl+C` in its terminal. To remove the **entire** local Kind cluster (including its local storage):

```powershell
kind delete cluster --name feedback-board
```

Only run that deletion if you are intentionally discarding the cluster and its data.

Back to [project README](../README.md).
