# Feedback Board — Monitoring and Alerting

This directory contains version-controlled configuration for monitoring the Feedback Board application in a local **Kind** Kubernetes cluster. It uses **Prometheus**, **Blackbox Exporter** and **Grafana**.

> **Scope:** Local development and academic DevOps demonstration. This setup is not production-hardened. Metrics/Grafana internal data are not persistent, no real external alert notification destination is configured, and centralized log aggregation is not installed.

## Architecture

```text
Kind cluster: feedback-board

Namespace: feedback-board                  Namespace: monitoring
  frontend Service :80 <---- HTTP probe ---- Blackbox Exporter
  backend Service :8090 <--- HTTP probe ---- Blackbox Exporter
                                                ^ /probe
                                                |
                                            Prometheus
                                         scrape every 30s
                                                |
                                               PromQL
                                                |
                                             Grafana
                                      dashboard + alert rules
```

Prometheus **scrapes Blackbox Exporter**, which checks the application endpoints. Grafana queries Prometheus; it does not send HTTP probes directly to the application.

## Files

| Path | Responsibility |
|---|---|
| `prometheus-values.yaml` | Lightweight server resources, retention, and the `feedback-board-http` scrape job |
| `blackbox-values.yaml` | Blackbox HTTP 2xx probing module |
| `grafana-values.yaml` | Grafana resources, data source and file provisioning |
| `dashboards/feedback-board.json` | Version-controlled availability/response-time dashboard |
| `alerting/feedback-board-alerts.yaml` | Two Grafana availability alert rules |
| `apply-dashboard.ps1` | Creates/updates dashboard ConfigMap on Windows |
| `apply-alerts.ps1` | Creates/updates alert rules ConfigMap on Windows |
| `README.md` | This guide |

The ConfigMaps **must exist before Grafana is installed**, because `grafana-values.yaml` references them. The GitHub Actions CD workflow performs the same provisioning using `kubectl` commands on Ubuntu; the PowerShell scripts are for convenient local use.

## Prerequisites

Docker Desktop (Linux containers), an existing Kind cluster called `feedback-board`, `kubectl`, Helm, and the frontend/backend already deployed in the `feedback-board` namespace. Commands below are for **Windows PowerShell** from the **repository root**.

```powershell
kind get clusters
kubectl cluster-info
kubectl get pods -n feedback-board
helm version
```

## Resource planning

The locally validated Docker/Kind environment had **2 logical CPUs** and approximately **3.28 GiB RAM** assigned to Docker. Grafana did not start reliably with an earlier 256 MiB limit; the versioned configuration provides a larger allocation.

| Component | CPU request | CPU limit | Memory request | Memory limit |
|---|---:|---:|---:|---:|
| Prometheus server | 50m | 300m | 128 MiB | 384 MiB |
| Blackbox Exporter | 10m | 100m | 24 MiB | 64 MiB |
| Grafana | 500m | 2000m | 1 GiB | 1536 MiB |

Requests reserve schedulable capacity; limits cap usage. The cluster also runs the application and Kubernetes system processes. Check node allocations before troubleshooting memory or CPU problems:

```powershell
kubectl describe node feedback-board-control-plane
```

## Install monitoring locally

The Helm chart versions below are the same versions pinned in `.github/workflows/cd.yml`. Do not silently replace them with newer versions when trying to reproduce the tested environment.

### 1. Namespace and Helm repositories

```powershell
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts --force-update
helm repo add grafana-community https://grafana-community.github.io/helm-charts --force-update
helm repo update
```

### 2. Prometheus

```powershell
helm upgrade --install prometheus prometheus-community/prometheus `
  --version 29.45.1 `
  --namespace monitoring `
  --values monitoring/prometheus-values.yaml `
  --wait --timeout 10m
```

The configuration uses 24-hour metric retention, disables Prometheus persistent storage, and disables Alertmanager, kube-state-metrics, node-exporter and Pushgateway to conserve resources. **Grafana**, not Alertmanager, evaluates the two application availability alerts.

### 3. Blackbox Exporter

```powershell
helm upgrade --install blackbox prometheus-community/prometheus-blackbox-exporter `
  --version 11.21.1 `
  --namespace monitoring `
  --values monitoring/blackbox-values.yaml `
  --wait --timeout 10m
```

The configured HTTP targets are:

| Target | Probe address |
|---|---|
| Frontend | `http://frontend.feedback-board.svc.cluster.local/` |
| Backend health | `http://backend.feedback-board.svc.cluster.local:8090/api/health` |

Prometheus job `feedback-board-http` scrapes every **30 seconds**. `probe_success = 1` indicates an HTTP probe succeeded; `0` indicates failure. Missing samples or a query error should be investigated separately.

### 4. Grafana ConfigMaps

```powershell
.\monitoring\apply-dashboard.ps1
.\monitoring\apply-alerts.ps1
```

Both scripts are idempotent: they create or update the existing ConfigMaps. Confirm their existence:

```powershell
kubectl get configmap feedback-board-grafana-dashboard -n monitoring
kubectl get configmap feedback-board-grafana-alerts -n monitoring
```

### 5. Grafana

First validate the chart template:

```powershell
helm template grafana grafana-community/grafana `
  --version 14.4.0 `
  --namespace monitoring `
  --values monitoring/grafana-values.yaml > $null
```

Then install or upgrade:

```powershell
helm upgrade --install grafana grafana-community/grafana `
  --version 14.4.0 `
  --namespace monitoring `
  --values monitoring/grafana-values.yaml `
  --wait --timeout 20m
```

Grafana 13.3.0 is deployed with one replica, `Recreate` updates, startup checks, a provisioned Prometheus data source, a ConfigMap-backed dashboard, and file-provisioned alert rules. This avoids running two Grafana Pods simultaneously during updates on constrained hardware.

### 6. Confirm the stack

```powershell
kubectl get pods -n monitoring
kubectl get services -n monitoring
helm list -n monitoring
```

Expected healthy readiness: Blackbox `1/1`, Grafana `1/1`, and Prometheus server `2/2`. Do not assume a Pod is healthy based only on `STATUS=Running`; inspect its `READY` count.

## Access Grafana and Prometheus

Run each `kubectl port-forward` in a separate terminal and keep it open.

**Grafana:**

```powershell
kubectl port-forward -n monitoring service/grafana 3000:80
```

Open <http://localhost:3000>. Login is `admin`; retrieve the password from the Kubernetes Secret:

```powershell
$secret = kubectl get secret grafana -n monitoring -o jsonpath="{.data.admin-password}"
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($secret))
```

Do not print this password in CI logs or commit it to the repository. In Grafana, open **Dashboards → Feedback Board → Feedback Board Monitoring**. The Prometheus data source is provisioned automatically.

**Prometheus:**

```powershell
kubectl port-forward -n monitoring service/prometheus-server 9090:80
```

Open <http://localhost:9090> and inspect **Status → Targets** or run a PromQL query.

## Dashboard and metrics

The source file is `dashboards/feedback-board.json`. The **Feedback Board Monitoring** dashboard contains four panels:

| Panel | Metric |
|---|---|
| Frontend Availability | Frontend `probe_success` (UP/DOWN) |
| Backend Availability | Backend `probe_success` (UP/DOWN) |
| Frontend Response Time | Frontend `probe_duration_seconds` |
| Backend Response Time | Backend `probe_duration_seconds` |

Useful PromQL queries:

```promql
probe_success{job="feedback-board-http"}
```

```promql
probe_duration_seconds{job="feedback-board-http"}
```

`probe_duration_seconds` is the **end-to-end probe duration**, not strictly application-side processing latency. The dashboard refreshes every 30 seconds. After a restart, the panel may briefly display `No data` until fresh samples arrive.

## Alert rules

The source file is `alerting/feedback-board-alerts.yaml`, loaded by Grafana file provisioning:

| Rule | Condition | Evaluation | Pending period |
|---|---|---|---|
| `Feedback Board - Frontend Down` | Frontend `probe_success < 1` | Every 1 minute | 2 minutes |
| `Feedback Board - Backend Down` | Backend `probe_success < 1` | Every 1 minute | 2 minutes |

The rules are visible under **Alerting → Alert rules**. `noDataState: NoData` and `execErrState: Error` distinguish missing data and evaluation errors from an actual failed HTTP probe.

**Observed:** the two rules were provisioned and displayed in the `Normal` state. **Not yet tested:** deliberately causing an outage and observing `Pending → Firing → Normal` recovery. **No external email/webhook/paging contact point** has been configured; do not claim notifications were delivered.

## Updating dashboards and alerts

After changing the version-controlled dashboard JSON or alert rules YAML, apply the appropriate ConfigMap:

```powershell
.\monitoring\apply-dashboard.ps1
.\monitoring\apply-alerts.ps1
```

A modified ConfigMap does **not necessarily cause Grafana to reload file-provisioned alert definitions immediately**. When necessary, perform a controlled restart and wait for readiness:

```powershell
kubectl rollout restart deployment/grafana -n monitoring
kubectl rollout status deployment/grafana -n monitoring --timeout=20m
```

Confirm the dashboard and alert rules in the UI or API. Keep provisioned rule UIDs stable; do not create duplicate rules manually. **Grafana persistence is disabled**, so changes made only in the UI may be lost when its Pod is replaced. Keep intended configuration in Git.

## CI/CD integration

`.github/workflows/cd.yml` deploys the application into a temporary Kind cluster, runs smoke tests, then installs **Prometheus (chart 29.45.1)**, **Blackbox Exporter (chart 11.21.1)** and **Grafana (chart 14.4.0)**. It creates both ConfigMaps from the files in Git **before** installing Grafana. It then checks Kubernetes readiness, both Prometheus HTTP probes, the dashboard UID, and the two alert rule UIDs through the Grafana API.

This verifies provisioning in an ephemeral cluster; it is **not** a production release pipeline and does not verify actual alert delivery or a complete failure/recovery alert cycle.

## Troubleshooting

For Pod status, events and logs:

```powershell
kubectl get pods -n monitoring
kubectl get events -n monitoring
kubectl describe pod -n monitoring -l app.kubernetes.io/name=grafana
kubectl logs -n monitoring deployment/grafana --tail=100
kubectl logs -n monitoring deployment/prometheus-server --tail=100
kubectl logs -n monitoring deployment/blackbox-prometheus-blackbox-exporter --tail=100
```

If Grafana is `0/1 Running`, check startup probe failures, available node resources and mounted ConfigMaps. Its initial startup can be slow; do not immediately reduce its memory limits or reinstall the stack.

If a dashboard shows `No data`, run the `probe_success` query in Prometheus, inspect the `feedback-board-http` target and verify the application Pods:

```powershell
kubectl get pods -n feedback-board
kubectl get configmap feedback-board-grafana-dashboard -n monitoring
kubectl get configmap feedback-board-grafana-alerts -n monitoring
```

During a recent local Docker/Kind restart, `kubectl` briefly returned `EOF` while retrieving the Kubernetes OpenAPI schema. Once the node and monitoring Pods recovered, retrying `apply-alerts.ps1` succeeded. Such connectivity errors should be diagnosed before editing valid provisioning YAML.

## Data, security and limitations

- Prometheus measurements and Grafana's internal database are **not persistent**. Retention is configured at 24 hours, but the measurements can disappear sooner when temporary Pod storage is replaced.
- PocketBase application data is stored separately on the `feedback-board` backend PVC, not in monitoring volumes.
- This setup exposes UIs locally through port-forwarding, not a public Ingress/LoadBalancer.
- There is **no external alert notification destination** and no demonstrated alert firing/recovery test yet.
- Kubernetes logs remain accessible using `kubectl logs`. **No centralized logging collector (for example, Loki) is installed.**
- A production deployment would require hardening, persistent monitoring storage where needed, backups, authentication, TLS, access policies, and alert notification configuration.

Back to [project README](../README.md).
