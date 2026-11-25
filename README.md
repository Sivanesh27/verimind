# VeriMind — AI that knows when to verify

VeriMind is a **trust-aware AI agent**. It estimates how confident it is in each answer and then acts on that number:

| Confidence | What the agent does |
|---|---|
| **High** (≥ 80%) | Answers directly |
| **Medium** (55–80%) | Searches for evidence / runs a tool, re-answers, re-evaluates |
| **Low** (< 55%) | Asks a clarifying question, hands over to a specialist agent, or escalates to a human reviewer |

Every score is **explainable**: the user sees *why* the agent was unsure (missing information, conflicting evidence, low source reliability, ambiguous query, failed verification, inconsistent reasoning…), which signals produced the score, and which sources were used.

The live demo streams every reasoning step over WebSockets, keeps a full audit trail, includes a human review queue, a monitoring dashboard, and a built-in evaluation that compares a traditional agent with the trust-aware agent.

## Features

- **Confidence estimation layer** combining six signals: model self-assessment, self-consistency across independent reasoning paths, evidence support, source reliability, deterministic tool verification and query clarity — with hard caps for decisive red flags.
- **Decision router**: answer → verify → clarify → specialist agent → human escalation.
- **Explainability**: plain-language uncertainty factors, per-signal contribution bars, caps, sources and reasoning path.
- **Real-time UI**: agent steps, escalations, reviewer answers, monitor feed and evaluation progress all update live (Socket.IO).
- **Human-in-the-loop**: reviewer queue; reviewers are emailed (Brevo) on escalation and users are notified when answered.
- **Monitoring**: route distribution, confidence histogram, latency, escalation rate, live activity.
- **Evaluation**: baseline vs. trust-aware on 19 scenarios — accuracy, hallucination rate, failed decisions, unnecessary escalations, latency, calibration (ECE, Brier, reliability diagram).
- **Auth**: email + password with 6-digit email verification and password reset (Brevo), or *Continue with Google*. Roles: user / reviewer / admin.

## Tech stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React 18, Vite, React Router, Recharts, Socket.IO client | Vercel |
| Backend | Node.js 22, Express, Socket.IO, Zod (Docker) | Hugging Face Spaces (free, 16 GB RAM) |
| LLM | **Local Mistral 7B Instruct v0.2** (`LLM.gguf` in the project root) via node-llama-cpp, JSON-schema grammars for structured output. Optional: Anthropic Claude (`LLM_PROVIDER=anthropic`) | Runs inside the API process |
| Database | PostgreSQL | Neon |
| Email | Brevo transactional API | Brevo |
| Uptime | `/health` endpoint | UptimeRobot |

## Repository layout

```
verimind/
├── backend/                 Express API + agent
│   ├── src/
│   │   ├── agent/           trust-aware agent, baseline agent, confidence layer, router, tools
│   │   ├── eval/            dataset, runner, metrics
│   │   ├── routes/          REST endpoints
│   │   ├── services/        agent/eval orchestration, email, tokens, Google
│   │   ├── repositories/    SQL data access
│   │   ├── realtime/        Socket.IO server
│   │   ├── middleware/      auth, errors
│   │   ├── db/              schema + migration
│   │   └── config/          environment
│   ├── scripts/run-eval.js  CLI evaluation
│   └── tests/               unit tests (node:test)
├── frontend/                React SPA
│   └── src/{pages,components,context,lib,styles}
├── docs/                    architecture, scoring, API, deployment, evaluation, development
├── .github/workflows/       CI: test + deploy backend to Hugging Face on push
```

## Quick start (local)

```bash
# 1. Backend
cd backend
cp .env.example .env        # fill DATABASE_URL, JWT_SECRET, ADMIN_EMAILS
npm install
npm run dev                 # http://localhost:8080  (schema is created automatically,
                            #  ../LLM.gguf is loaded in the background — watch for "[llm] local model loaded")

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:8080
npm install
npm run dev                 # http://localhost:5173
```

Without `BREVO_API_KEY`, verification codes are printed in the backend console.

### About the local model

`LLM.gguf` (Mistral 7B Instruct v0.2, 2-bit quantized, ~3 GB) is git-ignored — GitHub rejects files over 100 MB. It needs ~4 GB of free RAM and runs on the CPU by default. On a 4-thread laptop CPU, one structured call takes roughly 15–60 s, so a full trust-aware run (about 6–8 calls) takes a few minutes; steps stream live so you can watch progress. A machine with a supported GPU (`LLM_GPU=auto`) is much faster. See [deployment.md](deployment.md) for local running and free hosting.

## Documentation

| Document | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, agent pipeline, data model, realtime events |
| [docs/CONFIDENCE_SCORING.md](docs/CONFIDENCE_SCORING.md) | Signals, weights, caps, thresholds, routing and explanations |
| [docs/API.md](docs/API.md) | REST endpoints and Socket.IO events |
| [deployment.md](deployment.md) | **Run locally + 100% free deployment** (GitHub → Hugging Face → Vercel → Neon → Brevo → Google → UptimeRobot) |
| [docs/EVALUATION.md](docs/EVALUATION.md) | Methodology, metrics and how to run experiments |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local setup, conventions, testing, troubleshooting |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | Live demonstration walkthrough across scenarios |
