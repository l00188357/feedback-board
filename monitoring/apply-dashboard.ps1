# Feedback Board - Grafana Dashboard ConfigMap
# Run from the repository root or any directory.

$ErrorActionPreference = "Stop"

$dashboardFile = Join-Path $PSScriptRoot "dashboards\feedback-board.json"
$namespace = "monitoring"
$configMapName = "feedback-board-grafana-dashboard"

if (-not (Test-Path $dashboardFile)) {
    throw "Dashboard file not found: $dashboardFile"
}

Write-Host "Applying Grafana dashboard ConfigMap..."

$manifest = kubectl create configmap $configMapName `
    --namespace $namespace `
    --from-file="feedback-board.json=$dashboardFile" `
    --dry-run=client `
    -o yaml

if ($LASTEXITCODE -ne 0) {
    throw "Failed to generate ConfigMap manifest."
}

$manifest | kubectl apply -f -

if ($LASTEXITCODE -ne 0) {
    throw "Failed to apply ConfigMap."
}

Write-Host "Grafana dashboard ConfigMap applied successfully."