# VeriMind — Running Locally & Deploying for Free

This guide covers everything needed to run VeriMind on your own computer and to deploy the full software **for free** (backend + your own LLM, frontend, database, email, login and monitoring).

**Contents**

1. [What you are running](#1-what-you-are-running)
2. [Prerequisites](#2-prerequisites)
3. [Run locally](#3-run-locally)
4. [Environment variables reference](#4-environment-variables-reference)
5. [Free deployment overview](#5-free-deployment-overview)
6. [Step-by-step free deployment](#6-step-by-step-free-deployment)
7. [After deployment: updates, roles, maintenance](#7-after-deployment)
8. [Performance expectations](#8-performance-expectations)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. What you are running

```
verimind/
├── LLM.gguf          your local LLM (Mistral 7B Instruct v0.2, ~3 GB) — NOT committed to git
├── backend/          Node.js API + trust-aware agent (loads LLM.gguf in-process)
├── frontend/         React web app
├── docs/             architecture, API, scoring, evaluation docs
└── .github/workflows/deploy-backend.yml   auto-deploys the backend on every push
```

| Part | Runs on (local) | Runs on (free cloud) |
|---|---|---|
| Frontend (React) | `http://localhost:5173` | **Vercel** |
| Backend API + LLM | `http://localhost:8080` | **Hugging Face Spaces** (Docker, 16 GB RAM, free) |
| Database (PostgreSQL) | Neon, Docker or local Postgres | **Neon** |
| Email (verification codes, escalation alerts) | printed in backend console | **Brevo** |
| Google login | optional | **Google Identity Services** |
| Uptime monitoring | — | **UptimeRobot** |

---

## 2. Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js 20+** (22 recommended) | <https://nodejs.org> — check with `node -v` |
| **Git** | <https://git-scm.com> |
| **`LLM.gguf`** in the project root | next to the `backend/` and `frontend/` folders |
| **~4 GB free RAM** | the model uses ~3.4 GB while loaded |
| **A PostgreSQL database** | easiest: a free Neon database (see 3.1) |

The model runs on the **CPU** by default. A GPU is optional (see `LLM_GPU`).

---

## 3. Run locally

### 3.1 Get a database (choose one)

**Option A — Neon (recommended, free, nothing to install)**
1. Sign up at <https://neon.tech> → create a project → database name `verimind`.
2. Copy the **pooled** connection string, e.g.
   `postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/verimind?sslmode=require`

**Option B — Docker**
```bash
docker run -d --name verimind-pg -e POSTGRES_PASSWORD=pg -e POSTGRES_DB=verimind -p 5432:5432 postgres:16-alpine
# DATABASE_URL=postgresql://postgres:pg@localhost:5432/verimind
```

**Option C — PostgreSQL installed on Windows/macOS/Linux**
Create a database named `verimind`, then use
`postgresql://postgres:<your-password>@localhost:5432/verimind`.

Tables are created automatically the first time the backend starts.

### 3.2 Configure and start the backend

```bash
cd backend
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
npm install
```

Edit `backend/.env` — the minimum you must set:

```ini
DATABASE_URL=<your connection string from 3.1>
JWT_SECRET=<long random string>
ADMIN_EMAILS=you@example.com           # this account becomes admin
LLM_PROVIDER=local
LLM_MODEL_PATH=../LLM.gguf
LLM_GPU=false
```

Generate a `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Start it:
```bash
npm run dev        # auto-restarts on code changes   (or: npm start)
```

You should see:
```
[db] schema up to date
[boot] VeriMind API listening on :8080 (development)
[llm] local model loaded in 1700ms (gpu=none, ctx=6144)
```

Check <http://localhost:8080/health> → `{"status":"ok","db":"ok","llm":{"provider":"local",...,"loaded":true}}`

### 3.3 Configure and start the frontend

Open a **second terminal**:

```bash
cd frontend
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
npm install
npm run dev
```

`frontend/.env`:
```ini
VITE_API_URL=http://localhost:8080
VITE_GOOGLE_CLIENT_ID=          # optional; leave empty to hide the Google button
```

### 3.4 Open the app

➡️ **<http://localhost:5173>**

1. Click **Get started** and register (use the email from `ADMIN_EMAILS` to be admin).
2. **Verification code:** without Brevo configured, the code is printed in the **backend terminal**:
   ```
   [email:dev] to=you@example.com subject="Verify your VeriMind email" ... Your email verification code is: 123456 ...
   ```
3. Enter the code → you land on the **Agent** page. Try the scenario chips (Factual, Hallucination trap, Ambiguous, Tool check…).
4. Use the ☀ / ◐ / ☾ switch (sidebar) for light, system or dark theme.

### 3.5 Optional local extras

| Want | Do |
|---|---|
| Real emails locally | set `BREVO_API_KEY` and `MAIL_FROM_EMAIL` in `backend/.env` (see 6.6) |
| Google login locally | create an OAuth client (6.7) with origin `http://localhost:5173`; set `GOOGLE_CLIENT_ID` (backend) and `VITE_GOOGLE_CLIENT_ID` (frontend) |
| Use a GPU | `LLM_GPU=auto` (or `cuda` / `vulkan` / `metal`) — needs ≥ 4 GB VRAM |
| Run unit tests | `cd backend && npm test` |
| Run the evaluation from the terminal | `cd backend && npm run eval -- tool ambiguous` (or no args for all scenarios) |
| Production build of the frontend | `cd frontend && npm run build && npm run preview` |

### 3.6 Stop / restart

Press `Ctrl + C` in each terminal. Next time just run `npm run dev` in `backend/` and `frontend/` again (no reinstall needed).

### 3.7 Share your local app publicly (optional, free)

Your PC can serve the backend to the internet through a Cloudflare tunnel:
```bash
# install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:8080
```
It prints `https://<random>.trycloudflare.com` — use it as `VITE_API_URL` for a Vercel frontend. Works only while your PC is on; the URL changes each run unless you create a named tunnel.

---

## 4. Environment variables reference

### Backend (`backend/.env` locally, Hugging Face Space settings in the cloud)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | Secret for login tokens (long random string) |
| `PORT` | | `8080` (`7860` in Docker) | API port |
| `NODE_ENV` | | `development` | `production` in the cloud |
| `CORS_ORIGINS` | ✅ cloud | `http://localhost:5173` | Allowed frontend origins, comma-separated, no trailing slash |
| `FRONTEND_URL` | | `http://localhost:5173` | Used for links in emails |
| `ADMIN_EMAILS` | | — | Emails that automatically get the admin role |
| `JWT_EXPIRES_IN` | | `7d` | Session length |
| `LLM_PROVIDER` | | `local` | `local` = your GGUF model; `anthropic` = Claude API |
| `LLM_MODEL_PATH` | | `../LLM.gguf` | Model file path (relative to `backend/` or absolute) |
| `LLM_MODEL_URL` | ✅ cloud | — | Download link for the model if the file is missing (first boot) |
| `LLM_MODEL_TOKEN` | | — | Hugging Face read token, only for a private model repo |
| `LLM_MODEL_NAME` | | `Mistral 7B Instruct v0.2 (GGUF)` | Display name |
| `LLM_CONTEXT_SIZE` | | `6144` | Context window (more = more RAM) |
| `LLM_THREADS` | | `0` (auto) | CPU threads |
| `LLM_GPU` | | `false` | `false` = CPU; `auto` / `cuda` / `vulkan` / `metal` |
| `LLM_SAMPLES` | | `1` | Extra self-consistency samples per question (each = one more model call) |
| `CONFIDENCE_HIGH` | | `0.8` | Score needed to answer directly |
| `CONFIDENCE_MEDIUM` | | `0.55` | Below this the agent clarifies / hands over / escalates |
| `GOOGLE_CLIENT_ID` | | — | Enables Google sign-in |
| `BREVO_API_KEY` | | — | Enables real emails (otherwise printed to console) |
| `MAIL_FROM_EMAIL` | with Brevo | — | Verified Brevo sender |
| `MAIL_FROM_NAME` | | `VeriMind` | Sender name |
| `ANTHROPIC_API_KEY`, `LLM_MODEL` | only if `LLM_PROVIDER=anthropic` | — | Claude API alternative |

### Frontend (`frontend/.env` locally, Vercel settings in the cloud)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL, no trailing slash |
| `VITE_GOOGLE_CLIENT_ID` | Same Google client ID as the backend; empty hides the button |

> `VITE_*` values are baked in at build time — **redeploy the frontend** after changing them.

---

## 5. Free deployment overview

```
                     push to main
 GitHub repo ───────────────────────────────┐
   │                                        │
   │ GitHub Actions: test → deploy backend/ │ Vercel auto-deploy frontend/
   ▼                                        ▼
 Hugging Face Space (Docker)            Vercel
 backend + Mistral 7B model   ◄──────── React app  ◄──── users
   │  downloads LLM.gguf from a Hugging Face model repo on boot
   ├──► Neon PostgreSQL
   ├──► Brevo (emails)
   ├──► Google (token check)
   └──► Wikipedia (evidence)
 UptimeRobot ──► /health every 5 min (alerts + keeps the Space awake)
```

| Service | What for | Free tier |
|---|---|---|
| GitHub + Actions | code, CI/CD | free |
| Hugging Face Spaces (CPU basic) | backend + LLM | 2 vCPU, **16 GB RAM** |
| Hugging Face model repo | stores `LLM.gguf` | free |
| Vercel (Hobby) | frontend | free |
| Neon | database | 0.5 GB |
| Brevo | email | 300 emails/day |
| Google Identity Services | Google login | free |
| UptimeRobot | monitoring | 50 monitors |

> **Why not Render?** Render's free plan has only 512 MB RAM; the model needs ~4 GB. Hugging Face's free Docker Spaces give 16 GB, so everything — including your own LLM — runs at no cost.

---

## 6. Step-by-step free deployment

Do the steps **in order**; later steps use values from earlier ones. Keep a notepad with: Neon URL, HF token, model URL, Space URL, Vercel URL, Brevo key, Google client ID.

### 6.1 Push the code to GitHub

1. On <https://github.com/new> create an **empty** repository named `verimind` (no README, no .gitignore, no license).
2. In the project folder:

```bash
cd verimind
git init
git add .
git status
```

✅ **Check `git status`:** `LLM.gguf`, `backend/.env` and `frontend/.env` must **not** be listed (they are in `.gitignore`). GitHub rejects files over 100 MB and `.env` files contain secrets.

```bash
git commit -m "Initial commit: VeriMind trust-aware AI agent"
git branch -M main
git remote add origin https://github.com/<your-username>/verimind.git
git push -u origin main
```

The first push starts the **Deploy backend** GitHub Action, which fails until step 6.4 is done — that's expected.

### 6.2 Upload the model to Hugging Face

1. Sign up at <https://huggingface.co>.
2. **Profile → Settings → Access Tokens → Create new token** → type **Write** → copy it (this is `HF_TOKEN`).
3. Upload the model from the project folder:

```bash
pip install -U "huggingface_hub[cli]"
huggingface-cli login                                   # paste the token
huggingface-cli repo create verimind-llm --type model
huggingface-cli upload <hf-username>/verimind-llm LLM.gguf LLM.gguf
```

(No Python? Open <https://huggingface.co/new>, create a model repo `verimind-llm`, then **Files → Add file → Upload files** and drag `LLM.gguf` in.)

Your model URL (`LLM_MODEL_URL`):
```
https://huggingface.co/<hf-username>/verimind-llm/resolve/main/LLM.gguf
```
Mistral 7B Instruct is Apache-2.0 licensed, so a public repo is fine. For a private repo, also set `LLM_MODEL_TOKEN` (a read token) in 6.4.

### 6.3 Create the Neon database

1. <https://neon.tech> → **New project** → database `verimind`, region close to you.
2. **Connection Details** → choose **Pooled connection** → copy the string → this is `DATABASE_URL`.

### 6.4 Deploy the backend to a Hugging Face Space

**a. Create the Space**
<https://huggingface.co/new-space> → name `verimind-api` → SDK **Docker** → template **Blank** → hardware **CPU basic · Free** → visibility **Public** (the frontend must reach the API; your secrets stay hidden).

**b. Add settings** — Space → **Settings → Variables and secrets**

*Secrets* (hidden):

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon string (6.3) |
| `JWT_SECRET` | output of `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `BREVO_API_KEY` | from 6.6 (can add later) |
| `GOOGLE_CLIENT_ID` | from 6.7 (can add later) |
| `LLM_MODEL_TOKEN` | only for a private model repo |

*Variables*:

| Name | Value |
|---|---|
| `LLM_MODEL_URL` | model URL (6.2) |
| `ADMIN_EMAILS` | your email |
| `MAIL_FROM_EMAIL` | your verified Brevo sender (6.6) |
| `CORS_ORIGINS` | your Vercel URL (6.5), e.g. `https://verimind.vercel.app` |
| `FRONTEND_URL` | same Vercel URL |

**c. Connect GitHub to the Space** — GitHub repo → **Settings → Secrets and variables → Actions**:
- **Secrets** tab → `HF_TOKEN` = your Hugging Face write token
- **Variables** tab → `HF_SPACE` = `<hf-username>/verimind-api`

**d. Deploy** — GitHub → **Actions → Deploy backend to Hugging Face → Run workflow**.
The workflow runs the backend tests, then pushes `backend/` (with its `Dockerfile`) to the Space.

**e. Watch it start** — Space page → **Logs**:
```
[db] schema up to date
[boot] VeriMind API listening on :7860 (production)
[llm] model not found, downloading from huggingface.co ...
[llm] download 50% ...
[llm] model download complete
[llm] local model loaded in ...
```

**f. Your API URL:** `https://<hf-username>-verimind-api.hf.space`
Check `https://<hf-username>-verimind-api.hf.space/health` → `"db":"ok"` and `"loaded":true`.

From now on, every push to `main` that changes `backend/` redeploys automatically.

### 6.5 Deploy the frontend to Vercel

1. <https://vercel.com> → sign in with GitHub → **Add New → Project** → import `verimind`.
2. **Root Directory:** `frontend` (framework Vite is detected; `vercel.json` handles page routing).
3. **Environment Variables:**
   - `VITE_API_URL` = `https://<hf-username>-verimind-api.hf.space`
   - `VITE_GOOGLE_CLIENT_ID` = from 6.7 (can add later, then redeploy)
4. **Deploy** → you get `https://<project>.vercel.app`.
5. Put this URL into the Space variables `CORS_ORIGINS` and `FRONTEND_URL` (the Space restarts automatically).

Every push to `main` redeploys the frontend; pull requests get preview URLs.

### 6.6 Brevo (emails)

1. Sign up at <https://www.brevo.com>.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender** → verify the email Brevo sends you → this is `MAIL_FROM_EMAIL`.
3. **SMTP & API → API Keys → Generate a new API key** → this is `BREVO_API_KEY` (Space **secret**).

Until Brevo is set up, verification codes appear only in the Space **Logs**.

### 6.7 Google sign-in

1. <https://console.cloud.google.com> → create a project `VeriMind`.
2. **APIs & Services → OAuth consent screen** → External → app name, support email, developer email → save → **Publish app**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → **Web application**.
   **Authorized JavaScript origins:** `http://localhost:5173` and `https://<project>.vercel.app`. No redirect URIs needed.
4. Copy the **Client ID**:
   - Space secret `GOOGLE_CLIENT_ID`
   - Vercel env `VITE_GOOGLE_CLIENT_ID` → **Redeploy** the frontend.

### 6.8 UptimeRobot (monitoring + keep-alive)

1. <https://uptimerobot.com> → sign up → **Add New Monitor**.
2. Type **HTTP(s)**, Friendly name `VeriMind API`,
   URL `https://<hf-username>-verimind-api.hf.space/health`, interval **5 minutes**.
3. Select your email as alert contact → **Create Monitor**.

This emails you on downtime and keeps the free Space from sleeping (Spaces sleep after 48 h without traffic).

### 6.9 Final checklist

- [ ] `…hf.space/health` → `db: ok`, `llm.loaded: true`
- [ ] Vercel site opens; ☀ / ◐ / ☾ theme switch works
- [ ] Register → code email arrives → verify → Agent page
- [ ] *Continue with Google* works on the Vercel domain
- [ ] "What is 48731 multiplied by 9257?" → live steps → calculator verification
- [ ] "Is it safe to take it with alcohol?" → clarifying question
- [ ] Fabricated question → escalation appears live in **Review queue** (admin) + email
- [ ] Reviewer answer appears live for the asker + email
- [ ] **Monitor** shows the runs; **Evaluation → Run evaluation** works (admin)

---

## 7. After deployment

**Updating the app**
```bash
git add .
git commit -m "Describe your change"
git push
```
→ GitHub Actions tests & redeploys the backend; Vercel redeploys the frontend.

**Roles**
- Emails in `ADMIN_EMAILS` become **admin** automatically on every server start.
- Admins can promote others to **reviewer** or **admin** on the **Users** page.
- Reviewers handle the **Review queue**; admins can also run **evaluations**.

**Changing settings** — edit Space variables/secrets (Space restarts) or Vercel env vars (then redeploy).

**Database backups** — Neon keeps point-in-time history on the free plan (Branches/Restore in the Neon dashboard).

**Logs** — backend: Space → **Logs**; frontend build: Vercel → **Deployments**; CI: GitHub → **Actions**.

---

## 8. Performance expectations

| Where | Hardware | Time per trust-aware answer |
|---|---|---|
| Laptop, CPU only (4 threads) | measured | ~4–5 min (each model call 12–100 s) |
| Free Hugging Face Space | 2 vCPU | several minutes |
| Any machine with a ≥ 4 GB GPU (`LLM_GPU=auto`) | GPU | much faster (seconds per call) |

The agent makes ~6–8 model calls per question (analysis, draft, sample, judges, verification). Every step streams live to the UI, so users see progress while they wait. Tips:
- Keep `LLM_SAMPLES=1`.
- The **Baseline** mode (single call) is fastest for quick demos.
- A full 19-scenario evaluation can take over an hour on CPU — run one category: `npm run eval -- tool`.
- For speed without a GPU, `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` switches to the Claude API (paid per use).

---

## 9. Troubleshooting

### Local

| Problem | Fix |
|---|---|
| `Missing required environment variable` | Create `backend/.env` from `.env.example` and fill `DATABASE_URL`, `JWT_SECRET`. |
| `ECONNREFUSED` / database errors at startup | Database not running or wrong `DATABASE_URL`. |
| `Local model not found` | Put `LLM.gguf` in the project root, or set `LLM_MODEL_PATH`. |
| `too large for the available VRAM` | Set `LLM_GPU=false` (integrated graphics), or lower `LLM_CONTEXT_SIZE`. |
| Computer becomes very slow / out of memory | The model needs ~4 GB free RAM — close other apps, lower `LLM_CONTEXT_SIZE` to 4096. |
| Blank page after login | Update to the latest code (fixed), hard-refresh (`Ctrl+Shift+R`); check the browser console (F12). |
| Logged out unexpectedly | Update to the latest code (fixed: only an invalid session logs you out). |
| "Too many attempts" | Sign-in endpoints allow 50 requests / 15 min per IP — wait a few minutes. |
| Verification code not received | Without Brevo the code is in the backend terminal (`[email:dev] …`). |
| Google button missing | `VITE_GOOGLE_CLIENT_ID` empty → set it and restart `npm run dev`. |
| Socket shows **Offline** | Backend not running, or `CORS_ORIGINS` doesn't include `http://localhost:5173`. |
| `Local model produced incomplete JSON` | Token budget ran out — raise `MAX_TOKENS` in `backend/src/agent/providers/local.js`. |
| Port already in use | Change `PORT` (backend) or run `npm run dev -- --port 5174` (frontend, then add it to `CORS_ORIGINS`). |

### Cloud

| Problem | Fix |
|---|---|
| Action: "Set the HF_TOKEN secret and HF_SPACE variable" | Add both in GitHub → Settings → Secrets and variables → Actions. |
| Action: `git push` 401/403 | Token needs **Write** permission; `HF_SPACE` must be `username/space-name`. |
| Space log: `Model download failed: HTTP 401/404` | `LLM_MODEL_URL` must contain `/resolve/main/`; private repo needs `LLM_MODEL_TOKEN`. |
| Browser console: CORS error | `CORS_ORIGINS` must exactly equal the Vercel URL (`https://…vercel.app`, no trailing slash). |
| Google: "origin not allowed" | Add the exact Vercel URL to the OAuth client's Authorized JavaScript origins. |
| No emails in production | `BREVO_API_KEY` set as Space secret? Sender verified? Look for `[email] Brevo error` in Space logs. |
| `git push` rejected: file too large | `LLM.gguf` was committed: `git rm --cached LLM.gguf && git commit -m "Remove model" && git push`. |
| Space shows **Sleeping** / **Building** | Open the Space page to wake it; check build logs. UptimeRobot keeps it awake. |
| First request after a restart is slow | The Space re-downloads and loads the model after each restart (no persistent disk on the free tier). |

---

More documentation: [README.md](README.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/API.md](docs/API.md) · [docs/CONFIDENCE_SCORING.md](docs/CONFIDENCE_SCORING.md) · [docs/EVALUATION.md](docs/EVALUATION.md) · [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)
