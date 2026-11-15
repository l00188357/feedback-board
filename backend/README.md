# Backend — PocketBase

This directory builds the Feedback Board API using **PocketBase 0.41.1** and its embedded **SQLite** database. Unlike a Node.js backend, the backend is the PocketBase executable with a version-controlled JavaScript database migration; there is no separate Node backend application or `npm` build.

## Files

| File | Purpose |
|---|---|
| `Dockerfile` | Downloads the Linux AMD64 PocketBase binary, bundles migrations, serves port 8090 |
| `pb_migrations/1793600000_create_feedbacks.js` | Creates the `feedbacks` collection and permissions |

The container starts with:

```text
/pb/pocketbase serve --http=0.0.0.0:8090
```

## Feedback data model

The migration defines one base collection, `feedbacks`:

| Field | Type | Validation |
|---|---|---|
| `name` | Text | Required, 1–60 characters |
| `category` | Single select | Required: `Suggestion`, `Bug`, `Compliment` |
| `message` | Text | Required, 1–500 characters |
| `created` | Autodate | Set on record creation |
| `updated` | Autodate | Updated on record changes |

PocketBase also provides a record `id`. The migration configures **public list, view and create** operations; update and delete rules are `null`, so ordinary unauthenticated clients cannot change or delete records. This is a simple public feedback board, not a private submission system.

## API endpoints

- `GET /api/health` — service health, used for container and Kubernetes health checks.
- `GET /api/collections/feedbacks/records` — list feedback (frontend requests newest records first, up to 50).
- `POST /api/collections/feedbacks/records` — create feedback.

Example request body:

```json
{
  "name": "Sample User",
  "category": "Suggestion",
  "message": "Add a filter for feedback categories."
}
```

The frontend calls these endpoints through **Nginx `/api/` reverse proxy** when containerized. This avoids embedding the internal backend address in the browser.

## Run using Docker Compose

From the **repository root**:

```powershell
docker compose up --build -d --wait
```

The backend is available at <http://127.0.0.1:8090/api/health>. The same health endpoint is proxied by the frontend at <http://localhost:8080/api/health>.

To check containers and logs:

```powershell
docker compose ps
docker compose logs backend --tail=100
```

To stop the stack while preserving its SQLite data:

```powershell
docker compose down
```

The named Docker volume `pocketbase_data` stores `/pb/pb_data`. Running `docker compose down -v` **deletes that volume**.

## Kubernetes storage and deployment

The backend Kubernetes Deployment is defined in `../k8s/backend-deployment.yaml` and uses:

- Image `feedback-board-backend:dev`, built from `backend/Dockerfile`.
- One replica, with the `Recreate` deployment strategy for SQLite.
- Container port **8090**, exposed by internal Service `backend`.
- A **1 GiB** PVC called `pocketbase-data`, mounted at `/pb/pb_data`.
- Readiness and liveness probes on `/api/health`.

The frontend's Nginx proxy forwards `/api/` to `http://backend:8090` within the Kubernetes application namespace.

For local Kubernetes access, after deploying the application:

```powershell
kubectl port-forward -n feedback-board service/backend 8091:8090
```

Then open <http://localhost:8091/api/health>. Storage was tested by deleting/replacing the backend Pod and verifying that records survived; storage is **not guaranteed** if the whole Kind cluster is removed.

## Smoke tests and migration considerations

The root script `scripts/smoke-test.mjs` checks frontend availability, PocketBase health through Nginx, and the public records API. Run it from the repository root after starting Docker Compose:

```powershell
node scripts/smoke-test.mjs
```

The `pb_migrations` folder is included in the image. Database schema changes should be made through migrations rather than manually editing a disposable SQLite database. No custom backend unit-test runner is currently defined; frontend Vitest tests and application-level integration smoke tests are handled by CI.

## Security and scope

This configuration is intended for a local demonstration. Feedback submission is public by design, and PocketBase administration should not be exposed on the public internet without additional authentication, rate limiting, transport security, access controls and backups. Never commit SQLite data files, superuser credentials, or secrets.

See [the root README](../README.md) for the complete project and [Kubernetes README](../k8s/README.md) for deployment details.
