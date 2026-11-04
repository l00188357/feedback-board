# Kubernetes Deployment — Feedback Board

## Overview

This directory contains the Kubernetes configuration files required to deploy the Feedback Board application to a local Kubernetes cluster using Kind (Kubernetes in Docker).

The application consists of two services:

- *Frontend:* Astro static website served by Nginx.
- *Backend:* PocketBase API with SQLite database storage.

Kubernetes manages the containers, networking, health checks, and persistent storage.

The deployment has been tested locally using Docker Desktop, Kind, and kubectl.

## 1. Prerequisites

The following tools must be installed:

- Docker Desktop with Linux containers enabled
- kubectl
- Kind
- Node.js (for running smoke tests)

## 2. Kubernetes Architecture

The application is deployed into a dedicated namespace named feedback-board.

*Frontend*
- One Kubernetes Deployment running Astro through Nginx.
- One internal ClusterIP Service on port 80.
- Readiness and liveness probes.

*Backend*
- One Kubernetes Deployment running PocketBase.
- One internal ClusterIP Service on port 8090.
- Readiness and liveness probes.
- A PersistentVolumeClaim for SQLite storage.
- A Recreate deployment strategy to avoid overlapping PocketBase instances during updates.

Nginx forwards frontend API requests to the backend Service using the internal hostname backend:8090.

## 3. Kubernetes Manifests

| File | Purpose |
|---|---|
| namespace.yaml | Creates the application namespace |
| backend-pvc.yaml | Requests 1 GiB of persistent SQLite storage |
| backend-deployment.yaml | Deploys PocketBase with persistent storage and health probes |
| backend-service.yaml | Exposes the backend inside the Kubernetes cluster |
| frontend-deployment.yaml | Deploys the Astro frontend through Nginx |
| frontend-service.yaml | Exposes the frontend inside the Kubernetes cluster |

## 4. Create the Kind Cluster

From the repository root, run:

powershell
kind create cluster --name feedback-board --wait 120s


Check that the cluster was created successfully:

powershell
kind get clusters
kubectl get nodes


The Kubernetes node should report Ready.

If the cluster already exists, skip the creation command.

## 5. Build and Load Docker Images

Build the backend image:

powershell
docker build -t feedback-board-backend:dev ./backend


Load it into Kind:

powershell
kind load docker-image feedback-board-backend:dev --name feedback-board


Build the frontend image:

powershell
docker build -t feedback-board-frontend:dev ./frontend


Load it into Kind:

powershell
kind load docker-image feedback-board-frontend:dev --name feedback-board


Kind uses its own container runtime environment, so locally built Docker images must be loaded into the cluster.

## 6. Deploy the Application

From the repository root, apply the namespace first:

powershell
kubectl apply -f k8s/namespace.yaml


Create the persistent storage claim:

powershell
kubectl apply -f k8s/backend-pvc.yaml


Deploy the backend:

powershell
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml


Deploy the frontend:

powershell
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml


Wait for both Deployments:

powershell
kubectl rollout status deployment/backend -n feedback-board --timeout=120s
kubectl rollout status deployment/frontend -n feedback-board --timeout=120s


## 7. Verify Kubernetes Resources

Check the Pods:

powershell
kubectl get pods -n feedback-board


Check the Services:

powershell
kubectl get services -n feedback-board


Check the persistent storage:

powershell
kubectl get pvc -n feedback-board


Expected results:

- Both Pods are Running and ready (1/1).
- Backend and frontend Services are available.
- The PocketBase PVC reports Bound.

## 8. Access the Application

Kubernetes Services use the internal ClusterIP type, so the application is not directly exposed on the host.

Use port forwarding to access the frontend:

powershell
kubectl port-forward -n feedback-board service/frontend 8081:80


Open the browser:

http://localhost:8081

Keep the terminal running while accessing the application.

Press Ctrl + C to stop port forwarding.

To access the PocketBase API directly, use a separate terminal:

powershell
kubectl port-forward -n feedback-board service/backend 8091:8090


PocketBase health endpoint:

http://localhost:8091/api/health

Feedback records endpoint:

http://localhost:8091/api/collections/feedbacks/records

## 9. Run Automated Smoke Tests

The project contains a Node.js smoke test that verifies:

1. The Astro frontend responds correctly.
2. PocketBase health checks work through Nginx.
3. The feedback collection API responds successfully.

With frontend port forwarding active, run this from the repository root:

powershell
$env:SMOKE_BASE_URL = "http://localhost:8081"
node scripts/smoke-test.mjs
Remove-Item Env:SMOKE_BASE_URL


Expected output:

text
PASS: Frontend Astro
PASS: PocketBase health through Nginx
PASS: Feedback collection API
All smoke tests passed!


## 10. SQLite Persistence

PocketBase uses SQLite, which stores data in a database file.

The backend mounts a PersistentVolumeClaim at:

/pb/pb_data

This allows the database to survive Pod replacement.

The backend Deployment uses one replica and the Recreate update strategy.

### Persistence Verification

A persistence test was performed using the following procedure:

1. Submit a test feedback through the PocketBase API.
2. Confirm the record is returned by the API.
3. Delete the backend Pod:

powershell
kubectl delete pod -n feedback-board -l app=backend


4. Wait for the Deployment to become available again:

powershell
kubectl rollout status deployment/backend -n feedback-board --timeout=120s


5. Reconnect to PocketBase and verify the feedback record still exists.

*Result:* The feedback remained available after the backend Pod was recreated.

This verifies persistence across Pod replacement in the local Kind cluster.

Note that a PVC does not guarantee persistence if the entire Kind cluster and its underlying storage are deleted.

## 11. Troubleshooting

Check Pod status:

powershell
kubectl get pods -n feedback-board


View backend logs:

powershell
kubectl logs deployment/backend -n feedback-board


View frontend logs:

powershell
kubectl logs deployment/frontend -n feedback-board


Inspect the backend Deployment:

powershell
kubectl describe deployment backend -n feedback-board


Inspect storage:

powershell
kubectl describe pvc pocketbase-data -n feedback-board


If a Pod cannot start, check its events:

powershell
kubectl describe pods -n feedback-board


## 12. Kubernetes and Docker Compose

The repository supports two container environments:

*Docker Compose*
- Used for local application execution.
- Runs frontend and backend using Docker.
- Uses a Docker-managed volume for SQLite.
- Used in automated CI smoke tests.

*Kubernetes*
- Used to demonstrate container orchestration and deployment.
- Runs the application inside a Kind cluster.
- Uses Deployments and Services.
- Uses a PersistentVolumeClaim for SQLite.
- Automatically recreates failed Pods through the Deployment controller.

These environments use separate storage. Feedback saved through Docker Compose will not automatically appear in Kubernetes.