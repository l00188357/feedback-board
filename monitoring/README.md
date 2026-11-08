# Feedback Board — Monitoring and Alerting

This directory contains the monitoring configuration for the **Feedback Board** application running in a local **Kind (Kubernetes in Docker)** cluster.

The monitoring stack consists of:

- **Prometheus:** collects and stores monitoring metrics.
- **Blackbox Exporter:** sends HTTP probes to the frontend and backend.
- **Grafana:** visualizes availability and response times and evaluates availability alerts.

The frontend and backend run in the `feedback-board` namespace. Monitoring services run separately in the `monitoring` namespace.

> **Scope:** This is a local development/academic demonstration. It is not a production monitoring deployment. Data retention, access control, notifications, and persistence require additional hardening for production.

## Architecture

```text
                       Kind cluster: feedback-board

  Namespace: feedback-board               Namespace: monitoring
  ┌────────────────────────────┐          ┌───────────────────────────┐
  │ Frontend Service (HTTP /)  │◄─ probe ─│ Blackbox Exporter         │
  │ Backend Service            │◄─ probe ─│ (HTTP /api/health)        │
  │ (HTTP :8090/api/health)    │          └─────────────┬─────────────┘
  └────────────────────────────┘                        │ /probe
                                           ┌────────────▼────────────┐
                                           │ Prometheus              │
                                           │ scrapes every 30 s      │
                                           └────────────┬────────────┘
                                                        │ PromQL
                                           ┌────────────▼────────────┐
                                           │ Grafana                 │
                                           │ Dashboard + alert rules │
                                           └─────────────────────────┘
```

Blackbox Exporter probes the targets, while **Prometheus scrapes Blackbox Exporter's `/probe` endpoint**. Grafana queries Prometheus; it does not directly probe the application.

## Repository structure

```text
monitoring/
├── prometheus-values.yaml           # Lightweight Prometheus configuration and HTTP scrape job
├── blackbox-values.yaml             # Blackbox Exporter HTTP probe module
├── grafana-values.yaml              # Grafana resources, data source, dashboard and alert provisioning
├── apply-dashboard.ps1              # Creates/updates the dashboard ConfigMap from JSON
├── dashboards/
│   └── feedback-board.json          # Version-controlled dashboard
├── alerting/
│   └── feedback-board-alerts.yaml    # Frontend and backend availability alert rules
└── README.md
```

The alert ConfigMap is currently created by a manual command (documented below); **there is not yet a committed `apply-alerts.ps1` script**. The dashboard and alert ConfigMaps must be created **before** installing/upgrading Grafana because `grafana-values.yaml` references them.

## Prerequisites

- Windows PowerShell (commands below use PowerShell syntax).
- Docker Desktop running **Linux containers**.
- `kubectl`, `kind`, and Helm installed and available in `PATH`.
- An existing Kind cluster named `feedback-board`.
- Frontend and backend deployed to namespace `feedback-board` and reachable through their Kubernetes Services.
- Internet access to download Helm charts and images on a clean installation.

Check the local environment:

```powershell
kind get clusters
kubectl cluster-info
kubectl get pods -n feedback-board
helm version
```

### Resource planning

The local environment used to validate this setup had **2 logical CPUs** and approximately **3.28 GiB of RAM** available to Docker/Kind. Grafana initially failed to start when restricted to **256 MiB**, so its limits were increased.

Configured resource budgets:

| Component | CPU request | CPU limit | Memory request | Memory limit |
|---|---:|---:|---:|---:|
| Prometheus server | 50m | 300m | 128 MiB | 384 MiB |
| Blackbox Exporter | 10m | 100m | 24 MiB | 64 MiB |
| Grafana | 500m | 2000m | 1 GiB | 1536 MiB |

These are **Kubernetes resource requests and limits**, not measurements of actual usage. The cluster also runs system services, the frontend, and the PocketBase backend. Check resources before deployment:

```powershell
docker info --format "Docker CPUs: {{.NCPU}} | Memory: {{.MemTotal}} bytes"
kubectl describe node feedback-board-control-plane
```

Look at `Allocatable`, `Allocated resources`, and node conditions. A Pod can remain `Pending` if resource **requests** cannot be scheduled. A container can be terminated if it exceeds its memory **limit**. Do not solve resource problems by arbitrarily lowering Grafana's memory limit.

## Install the monitoring stack

Run all commands from the **repository root** unless stated otherwise.

### 1. Create the monitoring namespace

```powershell
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
```

### 2. Add Helm repositories

```powershell
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana-community https://grafana-community.github.io/helm-charts
helm repo update
```

### 3. Install Prometheus

```powershell
helm upgrade --install prometheus prometheus-community/prometheus `
  --namespace monitoring `
  --values monitoring/prometheus-values.yaml `
  --wait --timeout 5m
```

Prometheus is configured with a 24-hour metrics retention period and **no persistent volume**. Several additional components (Alertmanager, kube-state-metrics, node-exporter, and Pushgateway) are disabled to limit resource usage in this local environment.

### 4. Install Blackbox Exporter

```powershell
helm upgrade --install blackbox prometheus-community/prometheus-blackbox-exporter `
  --namespace monitoring `
  --values monitoring/blackbox-values.yaml `
  --wait --timeout 5m
```

The Blackbox `http_2xx` module checks two HTTP endpoints:

| Target | Address |
|---|---|
| Frontend | `http://frontend.feedback-board.svc.cluster.local/` |
| Backend health check | `http://backend.feedback-board.svc.cluster.local:8090/api/health` |

The Prometheus job is named `feedback-board-http`, with a **30-second scrape interval**. `probe_success` is `1` for successful probes and `0` for failed probes.

### 5. Create the Grafana dashboard ConfigMap

```powershell
.\monitoring\apply-dashboard.ps1
```

Equivalent manual command:

```powershell
kubectl create configmap feedback-board-grafana-dashboard `
  --namespace monitoring `
  --from-file=feedback-board.json=monitoring/dashboards/feedback-board.json `
  --dry-run=client -o yaml | kubectl apply -f -
```

### 6. Create the Grafana alert rules ConfigMap

```powershell
kubectl create configmap feedback-board-grafana-alerts `
  --namespace monitoring `
  --from-file=feedback-board-alerts.yaml=monitoring/alerting/feedback-board-alerts.yaml `
  --dry-run=client -o yaml | kubectl apply -f -
```

> **Important:** Both ConfigMaps are currently required by `monitoring/grafana-values.yaml`. Creating them after Grafana installation can prevent the Grafana Pod from starting until the missing ConfigMaps exist.

### 7. Install Grafana

The validated Grafana Helm chart version is **`14.4.0`**. Pinning this version improves reproducibility; do not silently switch to the latest chart during a repeatable deployment.

Validate the template first:

```powershell
helm template grafana grafana-community/grafana `
  --version 14.4.0 `
  --namespace monitoring `
  --values monitoring/grafana-values.yaml > $null
```

Install or upgrade:

```powershell
helm upgrade --install grafana grafana-community/grafana `
  --version 14.4.0 `
  --namespace monitoring `
  --values monitoring/grafana-values.yaml `
  --wait --timeout 20m
```

Grafana uses one replica and a `Recreate` deployment strategy to avoid running two Grafana instances during updates on resource-constrained hardware. A startup probe allows additional time for initial startup. The Prometheus data source is provisioned automatically.

### 8. Validate the Pods and releases

```powershell
kubectl get pods -n monitoring
helm list -n monitoring
kubectl get configmaps -n monitoring
```

Expected states after successful deployment:

- Prometheus server: `2/2 Running`.
- Blackbox Exporter: `1/1 Running`.
- Grafana: `1/1 Running`.
- Helm releases: `deployed`.

## Access the UIs

The following commands run in the foreground. Keep each `port-forward` terminal open while using the corresponding web UI.

### Grafana

```powershell
kubectl port-forward -n monitoring service/grafana 3000:80
```

Open <http://localhost:3000>.

Login: `admin`. Retrieve the local admin password **without posting it in logs or commits**:

```powershell
$secret = kubectl get secret grafana -n monitoring -o jsonpath="{.data.admin-password}"
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($secret))
```

Under **Connections → Data sources**, Prometheus should already be configured. The dashboard is available in **Dashboards → Feedback Board → Feedback Board Monitoring**.

### Prometheus

```powershell
kubectl port-forward -n monitoring service/prometheus-server 9090:80
```

Open <http://localhost:9090>. Inspect **Status → Targets** and query the `feedback-board-http` job.

## Dashboard

Dashboard source: `monitoring/dashboards/feedback-board.json`.

The **Feedback Board Monitoring** dashboard contains:

1. **Frontend Availability** — `UP` when the frontend probe succeeds.
2. **Backend Availability** — `UP` when the backend health probe succeeds.
3. **Frontend Response Time** — Blackbox probe duration in seconds.
4. **Backend Response Time** — Blackbox probe duration in seconds.

Example PromQL queries:

```promql
probe_success{job="feedback-board-http"}
```

```promql
probe_duration_seconds{job="feedback-board-http"}
```

`probe_duration_seconds` measures the **total probe duration**, not solely application-side HTTP processing latency. Panels refresh every 30 seconds. Shortly after a Grafana restart, instant panels may temporarily display `No data` until fresh metrics are available; this should not automatically be interpreted as downtime.

The dashboard JSON is stored in Git, placed into the `feedback-board-grafana-dashboard` ConfigMap, and loaded using Grafana's file dashboard provider declared in `grafana-values.yaml`.

## Alert rules

Alert source: `monitoring/alerting/feedback-board-alerts.yaml`.

| Rule | Trigger | Evaluation group | Pending period |
|---|---|---|---|
| `Feedback Board - Frontend Down` | Frontend `probe_success < 1` | `feedback-board-availability` | 2 min |
| `Feedback Board - Backend Down` | Backend `probe_success < 1` | `feedback-board-availability` | 2 min |

The group evaluates every **1 minute**. The rules use `noDataState: NoData` and `execErrState: Error`, so missing data or query errors are separate states from an HTTP probe returning `0`.

Alert rules are read from the ConfigMap mounted under `/etc/grafana/provisioning/alerting/` when Grafana starts. They should show as provisioned rules under **Alerting → Alert rules**.

**Notification limitation:** This setup evaluates alert states but does **not** configure a real email, webhook, or paging destination. The original UI-only `empty` contact point had no integrations; its reference was intentionally removed from the exported YAML. Do not claim alert delivery has been demonstrated.

**Testing status:** The rules were observed in the `Normal` state. A controlled outage causing `Pending` → `Firing` → `Normal` recovery has **not yet been performed**. Treat the firing/recovery test as outstanding validation, not as completed evidence.

## Updating dashboards or alerts

### Dashboard change

1. Edit `monitoring/dashboards/feedback-board.json`.
2. Apply the updated ConfigMap:

   ```powershell
   .\monitoring\apply-dashboard.ps1
   ```

3. Verify the dashboard in Grafana. If changes are not reflected, confirm that the updated ConfigMap is mounted and consider a controlled Grafana restart.
4. Commit the JSON file and any accompanying configuration change.

### Alert change

1. Edit `monitoring/alerting/feedback-board-alerts.yaml`.
2. Update the ConfigMap:

   ```powershell
   kubectl create configmap feedback-board-grafana-alerts `
     --namespace monitoring `
     --from-file=feedback-board-alerts.yaml=monitoring/alerting/feedback-board-alerts.yaml `
     --dry-run=client -o yaml | kubectl apply -f -
   ```

3. For a **file-provisioned rule change**, recreate the Grafana Pod via the Deployment after confirming the ConfigMap is correct:

   ```powershell
   kubectl rollout restart deployment/grafana -n monitoring
   kubectl rollout status deployment/grafana -n monitoring --timeout=20m
   ```

4. Inspect **Alerting → Alert rules** and the Grafana logs. Keep the rule UIDs stable; avoid manually creating duplicate rules with the same UIDs in the UI.

> **Warning:** Grafana persistence is currently disabled. A restart discards changes created only through the UI; only provisioned resources are guaranteed to be reconstructed from the files described here. Back up any additional UI-created configuration before restarting.

## Troubleshooting

### Grafana Pod is Pending

```powershell
kubectl describe pod -n monitoring -l app.kubernetes.io/name=grafana
kubectl describe node feedback-board-control-plane
```

Look for `Insufficient cpu`, `Insufficient memory`, missing ConfigMaps, or image pull failures. Requests determine scheduling; limits determine allowable runtime usage.

### Grafana is Running but not Ready

```powershell
kubectl get pods -n monitoring
kubectl logs -n monitoring deployment/grafana --tail=100
kubectl describe pod -n monitoring -l app.kubernetes.io/name=grafana
```

Look for startup/liveness probe failures, slow plugin loading, and memory termination events. The previously attempted 256 MiB limit was insufficient for this local setup; use the versioned resource allocation instead of repeatedly removing health checks.

### `No data` in a panel

In Grafana **Explore**, run:

```promql
probe_success{job="feedback-board-http"}
```

Then check Prometheus targets and Blackbox logs:

```powershell
kubectl logs -n monitoring deployment/blackbox-prometheus-blackbox-exporter --tail=50
kubectl get pods -n feedback-board
```

A missing sample is not automatically equivalent to an HTTP probe failure.

### Dashboard or alert missing after restart

```powershell
kubectl get configmap feedback-board-grafana-dashboard -n monitoring
kubectl get configmap feedback-board-grafana-alerts -n monitoring
kubectl describe pod -n monitoring -l app.kubernetes.io/name=grafana
kubectl logs -n monitoring deployment/grafana --tail=100
```

Ensure that both ConfigMaps exist and the Grafana values file mounts/provisions their respective files. The ConfigMaps were created **manually/scripted on the local cluster**, not yet by the CD workflow.

### Docker/Kind image-import errors

The local Kind environment previously encountered `ctr: content digest ... not found` when loading a Grafana image. An alternative was to export the platform-specific image and load the archive:

```powershell
docker image save --platform linux/amd64 --output grafana-image.tar grafana/grafana:13.3.0-distroless
kind load image-archive grafana-image.tar --name feedback-board
```

Use this only if the corresponding error occurs; it is **not** part of routine installation. Remove the temporary archive when finished to free disk space.

## Persistence, security, and limitations

- **Prometheus metrics:** not persistent; retention is configured for 24 hours, but all collected metrics are lost if the Prometheus Pod's temporary storage is replaced.
- **Grafana internal database:** not persistent. Dashboards and alert rules stored in Git can be reconstructed through their ConfigMaps; other UI-created changes may be lost.
- **PocketBase application data:** managed separately by the backend PVC in the `feedback-board` namespace. Monitoring setup and removal must not delete that PVC.
- **Access:** Grafana is exposed locally using `kubectl port-forward`, not a public LoadBalancer or Ingress. Use the generated admin password; never commit passwords or Kubernetes Secrets.
- **Notifications:** alert evaluation is implemented, but no real notification destination is configured.
- **Alert firing/recovery test:** deferred and not yet demonstrated.
- **CD integration:** not yet implemented. A new cluster currently requires executing the monitoring installation and ConfigMap steps above in order.
- **Logs:** Kubernetes container logs can be viewed with `kubectl logs`; a centralized logging pipeline (e.g., Loki) is not installed in this stack.

## Further work

- Automate creation of the **alert ConfigMap** in the deployment process (the dashboard already has `apply-dashboard.ps1`).
- Integrate Prometheus, Blackbox Exporter, Grafana, and both ConfigMaps into the Kubernetes CD workflow **after** monitoring configuration and tests are complete.
- Run a controlled frontend/backend outage and record evidence of alert transitions to `Firing` and back to `Normal`.
- Configure a real notification contact point if notification delivery is required.
- Consider persistent volumes and backup/restore procedures for long-lived environments.
- Add centralized log aggregation if required by the assignment rubric.

## Useful commands

```powershell
# Show monitoring components
kubectl get pods -n monitoring
helm list -n monitoring

# Show application components
kubectl get pods -n feedback-board

# Read recent Grafana logs
kubectl logs -n monitoring deployment/grafana --tail=100

# Read recent Prometheus logs
kubectl logs -n monitoring deployment/prometheus-server --tail=100

# List the Grafana-related ConfigMaps
kubectl get configmap -n monitoring

# Check Helm's installed Grafana release
helm status grafana -n monitoring
```

---

**Project:** Feedback Board · **Environment:** local Kubernetes (Kind) · **Monitoring:** Prometheus + Blackbox Exporter + Grafana
