# Frontend — Astro Feedback Board

The Feedback Board frontend is built using **Astro 7**, TypeScript and a small amount of client-side JavaScript. The production build is static and served by **Nginx**. Users can view recent feedback and submit new records to a PocketBase API.

This README describes the actual application, replacing the default Astro starter documentation.

## Main files

| Path | Purpose |
|---|---|
| `src/pages/index.astro` | Feedback form and list UI |
| `src/lib/api.ts` | Fetches and creates feedback records using PocketBase REST API |
| `src/lib/validation.ts` | Input validation for `name`, `category` and `message` |
| `src/tests/` | Vitest tests for API, validation and page behavior |
| `nginx.conf` | Serves the built static site and proxies `/api/` to the backend |
| `Dockerfile` | Builds Astro with Node.js, then serves `dist/` from Nginx |
| `package.json` | npm scripts and dependencies |

## Requirements and local development

Node.js **22.23.4 or later** and npm are required. Run these commands from `frontend/`:

```powershell
npm ci
npm run dev
```

Open <http://localhost:4321>. The page requires a running PocketBase API for listing and submitting feedback. The frontend API client uses the optional `PUBLIC_POCKETBASE_URL` environment variable when running outside the Nginx container.

For example, start the backend using Docker Compose from the repository root, then create `frontend/.env` containing:

```dotenv
PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
```

Restart the Astro development server after changing `.env`. Access from a separate frontend origin requires the backend to accept that origin. The `.env` file is a **local development override**, not needed for the normal containerized setup.

## Input and API behavior

A feedback record contains:

- `name`: 1–60 non-whitespace characters after trimming.
- `category`: one of `Suggestion`, `Bug` or `Compliment`.
- `message`: 1–500 non-whitespace characters after trimming.

`src/lib/validation.ts` applies these checks in the browser. The PocketBase migration also constrains the stored data; **client-side validation is not a security boundary**.

The frontend API helper calls:

```text
GET  /api/collections/feedbacks/records?sort=-created&perPage=50
POST /api/collections/feedbacks/records
```

In production and Docker Compose, `PUBLIC_POCKETBASE_URL` is empty and requests use the same origin. Nginx then forwards `/api/` to `http://backend:8090`.

## Build, tests and lint

Run from `frontend/`:

```powershell
npm ci
npm run build
npm run test
npm run lint
npm run preview
```

| Command | Purpose |
|---|---|
| `npm run dev` | Local Astro development server |
| `npm run build` | Builds static site into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Runs Vitest unit tests once |
| `npm run lint` | Runs ESLint |

The test suite covers validation and the API behavior using Vitest. The GitHub Actions CI workflow runs build, tests, ESLint and a Trivy filesystem vulnerability scan; Docker Compose integration tests are executed in a separate CI job.

## Containerized run (recommended)

From the repository root:

```powershell
docker compose up --build -d --wait
```

Open <http://localhost:8080>. The frontend image uses a multi-stage Docker build: Node.js builds Astro and Nginx serves the generated files, including the `/api/` reverse proxy. The Compose backend runs PocketBase with persistent SQLite data.

The same frontend image is used in the Kind Kubernetes deployment. Access it with:

```powershell
kubectl port-forward -n feedback-board service/frontend 8081:80
```

Open <http://localhost:8081>. For full deployment instructions, see [k8s/README.md](../k8s/README.md).

## Smoke tests

The repository-level `scripts/smoke-test.mjs` verifies the frontend response, proxied backend health endpoint and feedback list API.

Docker Compose (default address):

```powershell
node scripts/smoke-test.mjs
```

Kind, with the frontend port-forward running:

```powershell
$env:SMOKE_BASE_URL = "http://localhost:8081"
node scripts/smoke-test.mjs
Remove-Item Env:SMOKE_BASE_URL
```

Run those smoke tests **from the repository root**; the Node.js integration script is not located inside `frontend/`.

See the [root README](../README.md) for project architecture, CI/CD and monitoring links.
