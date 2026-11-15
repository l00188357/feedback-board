# Feedback Board

A feedback collection application and a practical DevOps project demonstrating automated testing, containerization, Kubernetes deployment, continuous integration/delivery validation, and monitoring.

**Repository:** <https://github.com/l00188357/feedback-board>  
**Default branch:** `master`

## What the application does

Users can submit feedback with a name, category and message, then view the latest submissions. Supported categories are **Suggestion**, **Bug**, and **Compliment**. The application is intentionally small so the focus can be on DevOps practices rather than application complexity.

- **Frontend:** Astro (static HTML and client-side TypeScript), served by Nginx.
- **Backend:** PocketBase REST API, backed by SQLite.
- **Data model:** PocketBase `feedbacks` collection, created by a version-controlled migration.
- **Access:** public list, view and create; record updates and deletions require privileged access.

## Architecture

```text
Browser
   |
   v
Nginx + Astro frontend (:8080 in Compose / :8081 via Kind port-forward)
   |  /api/* reverse proxy
   v
PocketBase API (:8090) --> SQLite database

Kind Kubernetes cluster
  namespace feedback-board: frontend, backend, PocketBase PVC (1 GiB)
  namespace monitoring: Prometheus, Blackbox Exporter, Grafana

Blackbox HTTP probes --> Prometheus --> Grafana dashboard + alert rules
```

Nginx proxies `/api/` requests to PocketBase, so the containerized website uses same-origin API requests. The browser does not need to know the internal Kubernetes Service address.

## Repository layout

| Location | Purpose |
|---|---|
| [`frontend/`](frontend/README.md) | Astro application, validation, API client and unit tests |
| [`backend/`](backend/README.md) | PocketBase Docker image and feedback collection migration |
| [`compose.yaml`](compose.yaml) | Run the application with Docker Compose |
| [`k8s/`](k8s/README.md) | Application namespace, Deployments, Services and persistent storage |
| [`monitoring/`](monitoring/README.md) | Prometheus, Blackbox Exporter, Grafana dashboard and alerts |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | CI: build, unit tests, lint, security scan, Docker integration tests |
| [`.github/workflows/cd.yml`](.github/workflows/cd.yml) | CD validation: ephemeral Kind deployment, smoke tests and monitoring |
| [`scripts/smoke-test.mjs`](scripts/smoke-test.mjs) | HTTP checks for the frontend and PocketBase API |

## Quick start: Docker Compose (recommended)

Requirements: Git and Docker Desktop running Linux containers (with Docker Compose support). Run these commands from the **repository root**:

```powershell
git clone https://github.com/l00188357/feedback-board.git
cd feedback-board
docker compose up --build -d --wait
```

Open **<http://localhost:8080>** to submit and view feedback.

- Frontend: <http://localhost:8080>
- PocketBase health check through Nginx: <http://localhost:8080/api/health>
- Feedback records through Nginx: <http://localhost:8080/api/collections/feedbacks/records>
- PocketBase API directly on the local machine: <http://127.0.0.1:8090/api/health>

To verify the application with the same smoke test used in CI, install Node.js **22.23.4 or later** and run:

```powershell
node scripts/smoke-test.mjs
```

To inspect the containers or stop the application:

```powershell
docker compose ps
docker compose logs --tail=100
docker compose down
```

`docker compose down` keeps the named `pocketbase_data` volume. **Do not use `docker compose down -v` unless you intend to delete the stored SQLite data.**

## Run frontend checks locally

From the repository root, with Node.js 22.23.4 or later:

```powershell
cd frontend
npm ci
npm run build
npm run test
npm run lint
cd ..
```

The frontend uses Vitest for unit tests, ESLint for static checks, and Astro for its production build. See the [frontend README](frontend/README.md) for the standalone development server and backend API configuration.

## Kubernetes deployment (Kind)

Requirements: Docker Desktop, `kind`, `kubectl`, and Node.js for the smoke test.

```powershell
kind create cluster --name feedback-board --wait 120s
docker build -t feedback-board-backend:dev ./backend
docker build -t feedback-board-frontend:dev ./frontend
kind load docker-image feedback-board-backend:dev --name feedback-board
kind load docker-image feedback-board-frontend:dev --name feedback-board
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/backend-pvc.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
kubectl rollout status deployment/backend -n feedback-board --timeout=180s
kubectl rollout status deployment/frontend -n feedback-board --timeout=180s
kubectl get pods -n feedback-board
kubectl get pvc -n feedback-board
```

In a separate terminal, leave this running:

```powershell
kubectl port-forward -n feedback-board service/frontend 8081:80
```

Visit <http://localhost:8081>. To run smoke tests against Kind, use another PowerShell terminal:

```powershell
$env:SMOKE_BASE_URL = "http://localhost:8081"
node scripts/smoke-test.mjs
Remove-Item Env:SMOKE_BASE_URL
```

The backend stores SQLite data on a **1 GiB PersistentVolumeClaim**. That preserves data across backend Pod replacement, **not** necessarily deletion of the entire Kind cluster. See [k8s/README.md](k8s/README.md) for the complete procedure and persistence demonstration.

## Monitoring and alerting

The Kubernetes monitoring stack uses:

- **Prometheus** to scrape HTTP probe metrics every 30 seconds.
- **Blackbox Exporter** to check the frontend root path and PocketBase `/api/health`.
- **Grafana** to display frontend/backend availability and probe duration, and evaluate availability alert rules.

Dashboard: **Feedback Board Monitoring**, with two availability panels and two response-time panels. The two Grafana alert rules detect a successful-probe value below `1` for two minutes (with a one-minute evaluation interval).

Configuration and provisioning are kept in Git: `monitoring/*-values.yaml`, `monitoring/dashboards/feedback-board.json`, and `monitoring/alerting/feedback-board-alerts.yaml`. See **[monitoring/README.md](monitoring/README.md)** for Helm installation, ConfigMaps, access, diagnostics, limitations and the exact chart versions used by CD.

For a deployed local Kind stack, open Grafana using:

```powershell
kubectl port-forward -n monitoring service/grafana 3000:80
```

Then visit <http://localhost:3000>. Retrieve the admin password from the Kubernetes Secret as shown in the monitoring README; do not commit credentials.

## CI/CD and quality checks

The GitHub Actions workflows run on pull requests to `master`:

1. **CI — `Feedback Board CI`:** Node.js setup, Astro production build, Vitest unit tests, ESLint, Trivy filesystem scan for HIGH/CRITICAL vulnerabilities, Docker Compose build and integration smoke tests.
2. **CD — `Feedback Board CD - Kubernetes`:** creates a temporary Kind cluster, builds/loads images, deploys the application and storage, runs Kubernetes smoke tests, installs the monitoring Helm charts, provisions Grafana ConfigMaps, checks HTTP probes and confirms dashboard/alert rule provisioning.

CI also runs on pushes to `master`; the CD workflow is configured to run when the successful CI workflow on `master` completes. **This is a deployment test in an ephemeral cluster, not deployment to a permanent production environment.**

## Validation and known limitations

- Application smoke tests verify the frontend, proxied PocketBase health endpoint and `feedbacks` collection listing.
- The SQLite PVC was checked locally by recreating the backend Pod and confirming that feedback records remained available.
- Prometheus HTTP probes were observed to return `probe_success = 1` for frontend and backend, and Grafana dashboard panels and alert rules were provisioned.
- Monitoring installation and provision checks are part of the GitHub Actions CD workflow.
- **Not yet demonstrated:** intentionally taking a service down to observe an alert move to `Firing` and recover to `Normal`, and delivery to an external notification destination.
- This is a **local/academic DevOps demonstration**, not a hardened production environment: Grafana internal data and Prometheus measurements are not persistent, external alert notifications are not configured, and secrets and exposure would require additional production controls.

## Further documentation

- [Frontend development and tests](frontend/README.md)
- [PocketBase backend and data model](backend/README.md)
- [Kubernetes application deployment](k8s/README.md)
- [Monitoring, dashboards and alerting](monitoring/README.md)
