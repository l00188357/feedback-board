# Feedback Board - Grafana Alert Rules ConfigMap
# Can be executed from any directory.

$ErrorActionPreference = "Stop"

$namespace = "monitoring"
$configMapName = "feedback-board-grafana-alerts"

$alertsFile = Join-Path $PSScriptRoot "alerting\feedback-board-alerts.yaml"

if (-not (Test-Path $alertsFile)) {
    throw "Alert rules file not found: $alertsFile"
}

Write-Host "Applying Grafana alert rules ConfigMap..."

$manifest = kubectl create configmap $configMapName `
    --namespace $namespace `
    --from-file="feedback-board-alerts.yaml=$alertsFile" `
    --dry-run=client `
    -o yaml

if ($LASTEXITCODE -ne 0) {
    throw "Failed to generate alert rules ConfigMap."
}

$manifest | kubectl apply -f -

if ($LASTEXITCODE -ne 0) {
    throw "Failed to apply alert rules ConfigMap."
}

Write-Host "Grafana alert rules ConfigMap applied successfully."