# Development guide

## Prerequisites

- Node.js 20+ (22 recommended)
- A PostgreSQL database: a free Neon project, or local Postgres / Docker:
  ```bash
  docker run -d --name verimind-pg -e POSTGRES_PASSWORD=pg -e POSTGRES_DB=verimind -p 5432:5432 postgres:16-alpine
  # DATABASE_URL=postgresql://postgres:pg@localhost:5432/verimind
  ```
- The model file `LLM.gguf` in the project root (next to `backend/`), and ~4 GB of free RAM.
  `npm install` in `backend/` installs node-llama-cpp with prebuilt llama.cpp binaries (Windows, macOS, Linux).
  Use `LLM_GPU=auto` if you have a CUDA/Vulkan/Metal GPU with ≥ 4 GB of VRAM; keep `false` for integrated graphics
  (otherwise you get "too large for the available VRAM").

## Setup

```bash
cd backend && cp .env.example .env && npm install && npm run dev
cd frontend && cp .env.example .env && npm install && npm run dev
```

- API: <http://localhost:8080> (`/health` to check)
- App: <http://localhost:5173>
- Put your email in `ADMIN_EMAILS` to get the admin role (evaluations, user roles, review queue).
- Without `BREVO_API_KEY`, emails — including verification codes — are logged to the backend console.
- Without `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID`, the Google button is hidden.

## Scripts

| Location | Command | Purpose |
|---|---|---|
| backend | `npm run dev` | API with auto-reload (`node --watch`) |
| backend | `npm start` | production start |
| backend | `npm test` | unit tests (confidence, router, calculator, calibration) |
| backend | `npm run migrate` | apply schema manually (also runs at boot) |
| backend | `npm run eval` | CLI evaluation, writes `reports/` |
| frontend | `npm run dev` | Vite dev server |
| frontend | `npm run build` | production build to `dist/` |
| frontend | `npm run preview` | serve the build locally |

## Code organisation & conventions

- **Backend layers**: `routes` (HTTP + validation with Zod) → `services` (orchestration, side effects) → `repositories` (SQL only) / `agent` (pure agent logic). Routes never contain SQL; repositories never emit events.
- **Agent code is framework-free**: `agent/` and `eval/` do not import Express or Socket.IO, so they run from the CLI and tests.
- **Pure scoring**: `confidence.js` and `router.js` have no I/O — change them with tests.
- ES modules everywhere, async/await, `asyncHandler` for routes, `HttpError` for expected errors.
- **Frontend**: pages own data fetching; reusable presentation lives in `components/`; all server calls go through `lib/api.js`; realtime subscriptions use `useSocketEvent`.
- CSS uses design tokens in `styles/global.css` (dark + light via `prefers-color-scheme`).

## Adding a verification tool

1. Create `backend/src/agent/tools/<tool>.js` returning `{ ok, value | error }`.
2. Extend `QueryAnalysis` so the analyzer can request it.
3. Call it in the parallel block of `runTrustAgent` and map its outcome to a signal in `buildSignals`.
4. Add a weight in `WEIGHTS`, a factor in `explainConfidence`, and tests.

## Adding a specialist agent

Add a prompt to `SPECIALIST_SYSTEMS` in `agent/prompts.js` and the domain to the `domain` enum in `schemas.js`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Missing required environment variable` | Copy `.env.example` to `.env` and fill it. |
| `self-signed certificate` / SSL errors locally | Local URLs (`localhost`) disable TLS automatically; for other hosts TLS is on. |
| Socket "Offline" in dev | Backend not running or `CORS_ORIGINS` doesn't include `http://localhost:5173`. |
| 429 on ask | 2 concurrent runs per user / 60 per hour — wait. |
| `Local model not found` | Put `LLM.gguf` in the project root or set `LLM_MODEL_PATH`. |
| `too large for the available VRAM` | Set `LLM_GPU=false`, or lower `LLM_CONTEXT_SIZE`. |
| Answers are slow | Expected on CPU (minutes per question). Lower `LLM_SAMPLES` to 1, use a GPU, or switch `LLM_PROVIDER=anthropic`. |
| `Local model produced incomplete JSON` | The token budget ran out; raise `MAX_TOKENS` in `providers/local.js`. |
