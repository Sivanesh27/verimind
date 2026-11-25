# VeriMind — Running Locally & Deploying for Free

This guide covers everything needed to run VeriMind on your own computer and to deploy the full software **for free, without a credit card** (backend, LLM, frontend, database, email, login and monitoring).

**Contents**

1. [What you are running](#1-what-you-are-running)
2. [Prerequisites](#2-prerequisites)
3. [Run locally](#3-run-locally)
4. [Environment variables reference](#4-environment-variables-reference)
5. [Free deployment overview](#5-free-deployment-overview)
6. [Step-by-step free deployment](#6-step-by-step-free-deployment)
7. [After deployment](#7-after-deployment)
8. [Performance and free-tier limits](#8-performance-and-free-tier-limits)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. What you are running

```
verimind/
├── LLM.gguf          your local LLM (Mistral 7B Instruct v0.2, ~3 GB) — NOT committed to git
├── backend/          Node.js API + trust-aware agent
├── frontend/         React web app
├── docs/             architecture, API, scoring, evaluation docs
├── render.yaml       Render blueprint (free backend)
└── .github/workflows/ci.yml   runs tests + frontend build on every push
```

The agent can use **three interchangeable LLMs** — switch with one setting, `LLM_PROVIDER`:

| `LLM_PROVIDER` | Model | Where it runs | Use for |
|---|---|---|---|
| `local` | your `LLM.gguf` (Mistral 7B Instruct v0.2) | inside the backend, on your CPU | local development, offline, full privacy (slow: minutes/answer) |
| `mistral` | Mistral AI API, default `ministral-8b-latest` | Mistral's servers (free Experiment plan) | **free cloud deployment** (fast: seconds/answer) |
| `anthropic` | Claude | Anthropic API (paid) | optional |

| Part | Local | Free cloud |
|---|---|---|
| Frontend (React) | `http://localhost:5173` | **Vercel** |
| Backend API | `http://localhost:8080` | **Render** (free web service) |
| LLM | `LLM.gguf` on your PC (or Mistral API) | **Mistral AI API** (free Experiment plan) |
| Database (PostgreSQL) | Neon, Docker or local Postgres | **Neon** |
| Email | printed in backend console | **Brevo** |
| Google login | optional | **Google Identity Services** |
| Uptime monitoring | — | **UptimeRobot** |

---

## 2. Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js 20+** (22 recommended) | <https://nodejs.org> — check with `node -v` |
| **Git** | <https://git-scm.com> |
| **A PostgreSQL database** | easiest: a free Neon database (see 3.1) |
| For `LLM_PROVIDER=local` | `LLM.gguf` in the project root and **~4 GB free RAM** |
| For `LLM_PROVIDER=mistral` | a free Mistral API key (see 6.2) |

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

**Option C — PostgreSQL installed on your computer**
Create a database named `verimind`, then use `postgresql://postgres:<password>@localhost:5432/verimind`.

Tables are created automatically the first time the backend starts.

### 3.2 Configure and start the backend

```bash
cd backend
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
npm install
```

Edit `backend/.env` — the minimum:

```ini
DATABASE_URL=<your connection string from 3.1>
JWT_SECRET=<long random string>
ADMIN_EMAILS=you@example.com           # this account becomes admin

# Choose ONE LLM:
LLM_PROVIDER=local                     # your LLM.gguf on this PC (slow, private)
# LLM_PROVIDER=mistral                 # Mistral free API (fast) — also set LLM_API_KEY
# LLM_API_KEY=<your Mistral API key>
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
[boot] LLM provider: local                 (or: api (ministral-8b-latest @ https://api.mistral.ai/v1))
[db] schema up to date
[boot] VeriMind API listening on :8080 (development)
[llm] local model loaded in 1700ms ...      (local provider only)
```

Check <http://localhost:8080/health> → `{"status":"ok","db":"ok","llm":{...}}`

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
3. Enter the code → **Agent** page. Try the scenario chips (Factual, Hallucination trap, Ambiguous, Tool check…).
4. Use the ☀ / ◐ / ☾ switch (sidebar) for light, system or dark theme.

### 3.5 Optional local extras

| Want | Do |
|---|---|
| Fast answers locally | `LLM_PROVIDER=mistral` + `LLM_API_KEY` (see 6.2) |
| Real emails locally | set `BREVO_API_KEY` and `MAIL_FROM_EMAIL` (see 6.6) |
| Google login locally | OAuth client (6.7) with origin `http://localhost:5173`; set `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` |
| Use a GPU for `LLM.gguf` | `LLM_GPU=auto` (or `cuda` / `vulkan` / `metal`) — needs ≥ 4 GB VRAM |
| Run unit tests | `cd backend && npm test` |
| Run the evaluation from the terminal | `cd backend && npm run eval -- tool ambiguous` (no args = all scenarios) |
| Production build of the frontend | `cd frontend && npm run build && npm run preview` |

### 3.6 Stop / restart

`Ctrl + C` in each terminal. Next time just run `npm run dev` in `backend/` and `frontend/` again.

---

## 4. Environment variables reference

### Backend (`backend/.env` locally, Render → Environment in the cloud)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | Secret for login tokens (long random string) |
| `PORT` | | `8080` | API port (Render sets it automatically) |
| `NODE_ENV` | | `development` | `production` in the cloud |
| `CORS_ORIGINS` | ✅ cloud | `http://localhost:5173` | Allowed frontend origins, comma-separated, no trailing slash |
| `FRONTEND_URL` | | `http://localhost:5173` | Used for links in emails |
| `ADMIN_EMAILS` | | — | Emails that automatically get the admin role |
| `JWT_EXPIRES_IN` | | `7d` | Session length |
| `LLM_PROVIDER` | | `local` | `local`, `mistral` (any OpenAI-compatible API) or `anthropic` |
| **Mistral / API provider** | | | |
| `LLM_API_KEY` | ✅ for `mistral` | — | Mistral API key (console.mistral.ai) |
| `LLM_API_BASE_URL` | | `https://api.mistral.ai/v1` | Any OpenAI-compatible endpoint (Groq, OpenRouter, llama.cpp server) |
| `LLM_API_MODEL` | | `ministral-8b-latest` | e.g. `mistral-small-latest` for higher quality |
| `LLM_API_MIN_INTERVAL_MS` | | `1500` (Render blueprint: `3000`) | Gap between API calls; raise it if you see rate-limit (429) errors |
| `LLM_API_JSON_MODE` | | `json_schema` | `json_object` if the API doesn't support JSON schemas |
| **Local provider** | | | |
| `LLM_MODEL_PATH` | | `../LLM.gguf` | Model file path (relative to `backend/` or absolute) |
| `LLM_MODEL_NAME` | | `Mistral 7B Instruct v0.2 (GGUF)` | Display name |
| `LLM_CONTEXT_SIZE` | | `6144` | Context window (more = more RAM) |
| `LLM_THREADS` | | `0` (auto) | CPU threads |
| `LLM_GPU` | | `false` | `false` = CPU; `auto` / `cuda` / `vulkan` / `metal` |
| `LLM_MODEL_URL`, `LLM_MODEL_TOKEN` | | — | Download the GGUF on first boot (servers without the file) |
| **Agent** | | | |
| `LLM_SAMPLES` | | `1` | Extra self-consistency samples per question (each = one more call) |
| `CONFIDENCE_HIGH` | | `0.8` | Score needed to answer directly |
| `CONFIDENCE_MEDIUM` | | `0.55` | Below this the agent clarifies / hands over / escalates |
| **Integrations** | | | |
| `GOOGLE_CLIENT_ID` | | — | Enables Google sign-in |
| `BREVO_API_KEY` | | — | Enables real emails (otherwise printed to console) |
| `MAIL_FROM_EMAIL` | with Brevo | — | Verified Brevo sender |
| `MAIL_FROM_NAME` | | `VeriMind` | Sender name |
| `ANTHROPIC_API_KEY`, `LLM_MODEL` | for `anthropic` | — | Claude API alternative |

### Frontend (`frontend/.env` locally, Vercel → Settings → Environment Variables in the cloud)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL, no trailing slash |
| `VITE_GOOGLE_CLIENT_ID` | Same Google client ID as the backend; empty hides the button |

> `VITE_*` values are baked in at build time — **redeploy the frontend** after changing them.

---

## 5. Free deployment overview

```
                 git push (main)
 GitHub repo ──────────────┬──────────────────────────┐
   │ (CI: tests + build)   │ auto-deploy backend/     │ auto-deploy frontend/
                           ▼                          ▼
                        Render (free)              Vercel (free) ◄──── users
                        Node.js API ◄──────────────────┘ REST + WebSocket
                           ├──► Mistral AI API (LLM, free Experiment plan)
                           ├──► Neon PostgreSQL (free)
                           ├──► Brevo (email, free)
                           ├──► Google (login check)
                           └──► Wikipedia (evidence)
 UptimeRobot ──► /health every 5 min (alerts + keeps the free Render service awake)
```

| Service | What for | Free tier | Card needed? |
|---|---|---|---|
| GitHub + Actions | code, CI | free | No |
| **Mistral AI** (Experiment plan) | LLM | free, rate-limited (~1 request/second) | **No** — phone verification only |
| **Render** (Free instance) | backend | 512 MB RAM, 750 h/month, sleeps after 15 min idle | Officially no (occasionally asked as an anti-fraud check) |
| Vercel (Hobby) | frontend | free | No |
| Neon | database | 0.5 GB | No |
| Brevo | email | 300 emails/day | No |
| Google Identity Services | Google login | free | No |
| UptimeRobot | monitoring | 50 monitors, 5-min checks | No |

> **Why Mistral's API instead of `LLM.gguf` in the cloud?** The GGUF model needs ~4 GB RAM; free backend hosts give 512 MB. Mistral hosts its own models for free on the Experiment plan, so the backend stays small. Your `LLM.gguf` keeps working locally (`LLM_PROVIDER=local`).
>
> **Mistral free plan notes:** requests on the Experiment plan may be used by Mistral to improve its models — don't send sensitive data. Mistral 7B itself has been retired from their API; the default `ministral-8b-latest` is its small successor.

---

## 6. Step-by-step free deployment

Do the steps **in order**. Keep a notepad for: Mistral key, Neon URL, Render URL, Vercel URL, Brevo key, Google client ID.

### 6.1 Push the code to GitHub

Already done for this project: **<https://github.com/Sivanesh27/verimind>**. To publish later changes:

```bash
git add .
git commit -m "Describe your change"
git push
```

Never commit `LLM.gguf` or `.env` files (they are in `.gitignore`).

### 6.2 Get a free Mistral API key

1. Go to <https://console.mistral.ai> → sign up (email or Google).
2. Create/choose a workspace → **Billing / Plans** → choose the free **Experiment** plan → verify your **phone number** (no card).
3. **API Keys → Create new key** → copy it (shown once). This is `LLM_API_KEY`.

### 6.3 Create the Neon database

1. <https://neon.tech> → **New project** → database `verimind`, region **AWS Asia Pacific (Singapore)** (same region as the Render blueprint).
2. **Connection Details → Pooled connection** → copy the string → `DATABASE_URL`.

### 6.4 Deploy the backend on Render

1. <https://render.com> → **Sign up with GitHub**.
2. **New → Blueprint** → connect the `verimind` repository → Render reads `render.yaml` and proposes the **verimind-api** free web service.
3. Fill in the values it asks for:

   | Key | Value |
   |---|---|
   | `LLM_API_KEY` | Mistral key (6.2) |
   | `DATABASE_URL` | Neon pooled string (6.3) |
   | `ADMIN_EMAILS` | your email, e.g. `sivaneshakumar@htic.iitm.ac.in` |
   | `CORS_ORIGINS` | your Vercel URL — not known yet: enter `http://localhost:5173` for now, update after 6.5 |
   | `FRONTEND_URL` | same as `CORS_ORIGINS` |
   | `GOOGLE_CLIENT_ID`, `BREVO_API_KEY`, `MAIL_FROM_EMAIL` | leave empty for now (6.6, 6.7) |

   `JWT_SECRET` is generated automatically.
4. **Apply** → the first build takes a few minutes. Logs should show:
   ```
   [boot] LLM provider: api (ministral-8b-latest @ https://api.mistral.ai/v1)
   [db] schema up to date
   [boot] VeriMind API listening on :10000 (production)
   ```
5. Your API URL: `https://verimind-api.onrender.com` (or similar — shown at the top of the service page).
   Open `…/health` → `{"status":"ok","db":"ok","llm":{"provider":"api",...}}`.

> **Manual alternative (no blueprint):** New → Web Service → repo → Root Directory `backend`, Runtime Node, Build `npm ci`, Start `npm start`, Instance type **Free**, Health check `/health`; add the variables from `render.yaml` and the table above.

### 6.5 Deploy the frontend on Vercel

1. <https://vercel.com> → **Sign up with GitHub** → **Add New → Project** → import `verimind`.
2. **Root Directory:** `frontend` (Vite is detected automatically).
3. **Environment Variables:**
   - `VITE_API_URL` = your Render URL, e.g. `https://verimind-api.onrender.com` (no trailing slash)
   - `VITE_GOOGLE_CLIENT_ID` = from 6.7 (add later, then redeploy)
4. **Deploy** → you get `https://<project>.vercel.app`.
5. Back in **Render → verimind-api → Environment**: set `CORS_ORIGINS` and `FRONTEND_URL` to that Vercel URL → **Save** (Render redeploys).

### 6.6 Brevo (emails)

1. <https://www.brevo.com> → sign up.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender** → verify the email → `MAIL_FROM_EMAIL`.
3. **SMTP & API → API Keys → Generate a new API key** → `BREVO_API_KEY`.
4. Add both in Render → Environment → Save.

Until then, verification codes appear in **Render → Logs** (`[email:dev] … code is: 123456`).

### 6.7 Google sign-in

1. <https://console.cloud.google.com> → create project `VeriMind` (no billing account needed).
2. **APIs & Services → OAuth consent screen** → External → app name, support email → save → **Publish app**.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
   **Authorized JavaScript origins:** `http://localhost:5173` and `https://<project>.vercel.app`. No redirect URI needed.
4. Copy the **Client ID**:
   - Render → Environment → `GOOGLE_CLIENT_ID` → Save
   - Vercel → Settings → Environment Variables → `VITE_GOOGLE_CLIENT_ID` → **Deployments → Redeploy**

### 6.8 UptimeRobot (monitoring + keep-awake)

<https://uptimerobot.com> → **Add New Monitor** → HTTP(s) → URL `https://<your-render-url>/health` → interval **5 minutes** → alert contact: your email → **Create**.

Render's free service sleeps after 15 minutes without traffic (first request then takes ~1 minute). The 5-minute pings keep it awake; one always-on service fits in Render's 750 free hours/month.

### 6.9 Final checklist

- [ ] Render `/health` → `db: ok`, `llm.provider: api`
- [ ] Vercel site opens; ☀ / ◐ / ☾ theme switch works; sidebar shows **Live**
- [ ] Register → code arrives (email or Render logs) → verify → Agent page
- [ ] *Continue with Google* works
- [ ] "What is 48731 multiplied by 9257?" → live steps → calculator verification
- [ ] "Is it safe to take it with alcohol?" → clarifying question
- [ ] Fabricated question → escalation in **Review queue** (admin) + email
- [ ] GitHub → **Actions** → CI is green

---

## 7. After deployment

**Update the app:** `git add . && git commit -m "…" && git push` → Render redeploys the backend, Vercel the frontend, GitHub Actions runs the tests.

**Change settings:** Render → Environment (auto-redeploys) · Vercel → Environment Variables (then Redeploy).

**Switch the LLM without code changes** (Render → Environment):

| Goal | Set |
|---|---|
| Higher-quality Mistral model | `LLM_API_MODEL=mistral-small-latest` |
| Groq free tier instead | `LLM_API_BASE_URL=https://api.groq.com/openai/v1`, `LLM_API_MODEL=llama-3.1-8b-instant`, `LLM_API_KEY=<groq key>` |
| Your own `LLM.gguf` served from your PC | run `llama-server -m LLM.gguf --port 8081` + `cloudflared tunnel --url http://localhost:8081`; set `LLM_API_BASE_URL=https://<tunnel>/v1`, `LLM_API_JSON_MODE=json_object` (works only while your PC is on) |

**Roles:** emails in `ADMIN_EMAILS` become admin on every start; admins promote others on the **Users** page.

**Logs:** backend → Render → Logs · frontend builds → Vercel → Deployments · tests → GitHub → Actions.

**Backups:** Neon keeps point-in-time history (Neon dashboard → Restore).

---

## 8. Performance and free-tier limits

| Setup | Time per trust-aware answer |
|---|---|
| Cloud: Render + Mistral free API | ~20–60 s (6–8 calls, spaced 3 s apart for the free-tier rate limit) |
| Local: `LLM_PROVIDER=mistral` | same |
| Local: `LLM_PROVIDER=local` on a 4-thread laptop CPU | ~4–5 min (measured) |

Limits to know:
- **Mistral Experiment plan:** ~1 request/second and monthly token limits (see console.mistral.ai → Limits). VeriMind queues and spaces calls and retries rate-limit errors automatically. A full 19-scenario evaluation makes ~200 calls — run it occasionally, or by category.
- **Render free:** sleeps after 15 min idle (UptimeRobot prevents it); 512 MB RAM; restarts on each deploy.
- **Neon free:** 0.5 GB storage — plenty for this app.
- **Brevo free:** 300 emails/day.

---

## 9. Troubleshooting

### Local

| Problem | Fix |
|---|---|
| `Missing required environment variable` | Create `backend/.env` from `.env.example` and fill `DATABASE_URL`, `JWT_SECRET`. |
| `ECONNREFUSED` / database errors at startup | Database not running or wrong `DATABASE_URL`. |
| `Local model not found` | Put `LLM.gguf` in the project root, or set `LLM_MODEL_PATH`. |
| `too large for the available VRAM` | Set `LLM_GPU=false` (integrated graphics), or lower `LLM_CONTEXT_SIZE`. |
| Computer slow / out of memory with `local` | The model needs ~4 GB free RAM — close other apps, or use `LLM_PROVIDER=mistral`. |
| Blank page after login | Pull the latest code (fixed); hard-refresh with `Ctrl+Shift+R`; check the browser console (F12). |
| "Too many attempts" | Sign-in endpoints allow 50 requests / 15 min per IP — wait a few minutes. |
| Verification code not received | Without Brevo the code is in the backend terminal (`[email:dev] …`). |
| Google button missing | `VITE_GOOGLE_CLIENT_ID` empty → set it and restart `npm run dev`. |
| Socket shows **Offline** | Backend not running, or `CORS_ORIGINS` doesn't include `http://localhost:5173`. |
| Port already in use | Change `PORT` (backend) or `npm run dev -- --port 5174` (frontend, and add it to `CORS_ORIGINS`). |

### Cloud

| Problem | Fix |
|---|---|
| Render asks for a card | Occasional anti-fraud check. Try again later / another browser, or contact Render support. |
| Render build fails in `npm ci` | Check the log; make sure Root Directory is `backend` and `NODE_LLAMA_CPP_SKIP_DOWNLOAD=true` is set. |
| Logs: `LLM_API_KEY is not set` | Add `LLM_API_KEY` in Render → Environment. |
| Agent fails with `LLM API error 401` | Wrong or revoked Mistral key — create a new one. |
| `LLM API error 429` / "Some checks unavailable" | Free-tier rate limit. VeriMind retries and skips optional checks automatically; set `LLM_API_MIN_INTERVAL_MS=3000` (or 5000) in Render, keep `LLM_SAMPLES=1`. |
| `LLM API error 400 … model` | Model name not available — use `ministral-8b-latest` or `mistral-small-latest`. |
| `Model returned invalid JSON` | Set `LLM_API_JSON_MODE=json_object`, or try `LLM_API_MODEL=mistral-small-latest`. |
| First request after a while takes ~1 min | Render free instance was asleep — set up UptimeRobot (6.8). |
| Browser console: CORS error | `CORS_ORIGINS` must exactly equal the Vercel URL (`https://…vercel.app`, no trailing slash). |
| Socket shows **Offline** in production | Same CORS issue, or the backend is asleep/redeploying. |
| Google: "origin not allowed" | Add the exact Vercel URL to the OAuth client's Authorized JavaScript origins. |
| No emails | `BREVO_API_KEY` set? Sender verified? Look for `[email] Brevo error` in Render logs. |
| `git push` rejected: file too large | `LLM.gguf` was committed: `git rm --cached LLM.gguf && git commit -m "Remove model" && git push`. |

---

More documentation: [README.md](README.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/API.md](docs/API.md) · [docs/CONFIDENCE_SCORING.md](docs/CONFIDENCE_SCORING.md) · [docs/EVALUATION.md](docs/EVALUATION.md) · [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)
