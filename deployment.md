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
├── deploy/oracle/    setup.sh, deploy.sh, pm2 config for the Oracle Cloud server
└── .github/workflows/deploy-backend.yml   tests + auto-deploys the backend on every push
```

| Part | Runs on (local) | Runs on (free cloud) |
|---|---|---|
| Frontend (React) | `http://localhost:5173` | **Vercel** |
| Backend API + LLM | `http://localhost:8080` | **Oracle Cloud Always Free VM** (Arm, up to 4 cores / 24 GB RAM) |
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

### Backend (`backend/.env` — on your PC and on the Oracle VM)

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
                        git push (main)
 GitHub repo ─────────────────────────────────────────┐
   │                                                  │
   │ GitHub Actions: test → SSH → deploy.sh           │ Vercel auto-deploy (frontend/)
   ▼                                                  ▼
 Oracle Cloud Always Free VM                      Vercel ◄──── users (browser)
 ┌──────────────────────────────────────┐            │
 │ Caddy  (HTTPS, https://<ip>.sslip.io) │◄───────────┘ REST + WebSocket
 │   └─► Node.js API (pm2)  :8080        │
 │        └─ LLM.gguf (Mistral 7B) in RAM│
 └──────────────────────────────────────┘
   ├──► Neon PostgreSQL     ├──► Brevo (email)
   ├──► Google (login)      └──► Wikipedia (evidence)
 UptimeRobot ──► /health every 5 min (downtime alerts)
```

| Service | What for | Free tier |
|---|---|---|
| GitHub + Actions | code, CI/CD | free |
| **Oracle Cloud Always Free** | backend + LLM | Arm VM up to **4 cores, 24 GB RAM**, 200 GB disk — free forever |
| sslip.io + Caddy | HTTPS domain + certificate | free, no signup |
| Vercel (Hobby) | frontend | free |
| Neon | database | 0.5 GB |
| Brevo | email | 300 emails/day |
| Google Identity Services | Google login | free |
| UptimeRobot | monitoring | 50 monitors |

> **Why Oracle?** The model needs ~4 GB RAM. Render's free plan has 512 MB, and Hugging Face now charges for Docker/CPU Spaces. Oracle's Always Free Arm VM gives up to 24 GB RAM at no cost, permanently.
>
> **About the card:** Oracle asks for a credit/debit card at signup **only to verify identity**. Resources marked *Always Free* are never charged. Do **not** click "Upgrade to Pay As You Go" if you want to stay 100% free — then nothing can ever be billed.

---

## 6. Step-by-step free deployment

Do the steps **in order**. Keep a notepad for: VM public IP, API URL, Neon URL, Vercel URL, Brevo key, Google client ID.

### 6.1 Push the code to GitHub

1. On <https://github.com/new> create a repository named `verimind` (**Public** is simplest — the VM clones it without a password; secrets are never in the code).
2. In the project folder:

```bash
cd verimind
git status          # LLM.gguf, backend/.env, frontend/.env must NOT be listed
git add .
git commit -m "VeriMind: trust-aware AI agent"
git branch -M main
git remote add origin https://github.com/<your-username>/verimind.git   # skip if already added
git push -u origin main
```

> **Private repo?** On the VM (step 6.3) clone with a token instead:
> `https://<your-username>:<github-token>@github.com/<your-username>/verimind.git`
> (GitHub → Settings → Developer settings → Fine-grained token with *Contents: Read-only* on this repo.)

### 6.2 Create the Oracle Cloud VM

**a. Sign up**
1. <https://signup.cloud.oracle.com> → fill in details → choose a **Home Region** near you (e.g. *India West (Mumbai)* or *India South (Hyderabad)*). The home region cannot be changed later.
2. Verify the card (a small temporary hold may appear, then is released). Account activation can take a few minutes.

**b. Create the instance**
1. Console → ☰ → **Compute → Instances → Create instance**.
2. **Name:** `verimind`.
3. **Image and shape → Edit:**
   - **Image:** *Canonical Ubuntu 22.04* (or 24.04).
   - **Shape:** *Change shape → Ampere → `VM.Standard.A1.Flex`* — set **4 OCPUs** and **24 GB memory** (the "Always Free-eligible" label must be shown). Minimum that works: 2 OCPUs / 12 GB.
4. **Networking:** keep the default new VCN and **Assign a public IPv4 address = Yes**.
5. **Add SSH keys:** *Generate a key pair for me* → **Save private key** (e.g. `ssh-key-verimind.key`). Keep it safe — you need it to log in and for GitHub Actions.
6. **Boot volume:** default (≈ 47 GB) is fine.
7. **Create.** After ~1 minute the state is **Running**; copy the **Public IP address**.

> **"Out of capacity for shape VM.Standard.A1.Flex"** is common in busy regions. Retry later, try another *Availability Domain* in the placement section, or temporarily use 2 OCPU / 12 GB.

**c. Open ports 80 and 443 in Oracle's network firewall**
1. Instance page → **Primary VNIC → Subnet** link → **Security Lists** → *Default Security List*.
2. **Add Ingress Rules** (twice):
   - Source CIDR `0.0.0.0/0`, IP protocol TCP, destination port **80**
   - Source CIDR `0.0.0.0/0`, IP protocol TCP, destination port **443**
3. Save. (Port 22 for SSH is already open. The setup script opens the VM's own firewall.)

### 6.3 Install VeriMind on the VM

**a. Connect with SSH** (Windows PowerShell, macOS or Linux terminal):

```powershell
# Windows: restrict the key file first, otherwise ssh refuses it
icacls .\ssh-key-verimind.key /inheritance:r /grant:r "$($env:USERNAME):(R)"

ssh -i .\ssh-key-verimind.key ubuntu@<PUBLIC_IP>
```
(macOS/Linux: `chmod 600 ssh-key-verimind.key && ssh -i ssh-key-verimind.key ubuntu@<PUBLIC_IP>`)

**b. Run the setup script** (on the VM):

```bash
curl -fsSL https://raw.githubusercontent.com/<your-username>/verimind/main/deploy/oracle/setup.sh -o setup.sh
bash setup.sh https://github.com/<your-username>/verimind.git
```

It installs Node.js 22, pm2 and Caddy, clones the repo to `~/verimind`, installs dependencies, opens ports 80/443 on the VM, configures HTTPS and starts the API. At the end it prints your API URL:

```
Your API URL:  https://140-238-12-34.sslip.io
```

(sslip.io maps `140-238-12-34.sslip.io` to the IP `140.238.12.34`; Caddy gets a free Let's Encrypt certificate for it automatically.) Note this URL — it is your **API URL**.

The API will report errors until the model and settings are in place (next steps).

### 6.4 Put the model on the VM

**Option A — upload from your PC** (simplest; ~3 GB). In a **new terminal on your PC**, from the `verimind` folder:

```powershell
scp -i .\ssh-key-verimind.key .\LLM.gguf ubuntu@<PUBLIC_IP>:/home/ubuntu/verimind/LLM.gguf
```

**Option B — download on the VM** (faster if your upload is slow): first upload `LLM.gguf` once to a free Hugging Face *model* repository (Hugging Face model repos are still free), then on the VM:

```bash
curl -L -o ~/verimind/LLM.gguf https://huggingface.co/<hf-username>/verimind-llm/resolve/main/LLM.gguf
```

Check on the VM: `ls -lh ~/verimind/LLM.gguf` → about 2.9 GB.

### 6.5 Create the Neon database

1. <https://neon.tech> → **New project** → database `verimind`, region close to your VM (e.g. AWS ap-south-1 / Singapore).
2. **Connection Details → Pooled connection** → copy the string → `DATABASE_URL`.

### 6.6 Configure the backend on the VM

On the VM:

```bash
nano ~/verimind/backend/.env
```

Set at least these values (Ctrl+O, Enter to save; Ctrl+X to exit):

```ini
NODE_ENV=production
PORT=8080
DATABASE_URL=<Neon pooled connection string>
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
ADMIN_EMAILS=<your email>
CORS_ORIGINS=https://<your-project>.vercel.app      # fill in after step 6.7
FRONTEND_URL=https://<your-project>.vercel.app

LLM_PROVIDER=local
LLM_MODEL_PATH=../LLM.gguf
LLM_GPU=false
LLM_THREADS=0
LLM_SAMPLES=1

BREVO_API_KEY=            # step 6.8
MAIL_FROM_EMAIL=          # step 6.8
GOOGLE_CLIENT_ID=         # step 6.9
```

Restart and watch the logs:

```bash
pm2 restart verimind-api
pm2 logs verimind-api            # Ctrl+C to stop watching
```

Expected:
```
[db] schema up to date
[boot] VeriMind API listening on :8080 (production)
[llm] local model loaded in ...ms (gpu=none, ctx=6144)
```

From your PC, open `https://<ip-with-dashes>.sslip.io/health` → `{"status":"ok","db":"ok","llm":{...,"loaded":true}}` 🎉

### 6.7 Deploy the frontend to Vercel

1. <https://vercel.com> → sign in with GitHub → **Add New → Project** → import `verimind`.
2. **Root Directory:** `frontend` (Vite is detected automatically).
3. **Environment Variables:**
   - `VITE_API_URL` = your API URL, e.g. `https://140-238-12-34.sslip.io` (no trailing slash)
   - `VITE_GOOGLE_CLIENT_ID` = from step 6.9 (add later, then redeploy)
4. **Deploy** → you get `https://<your-project>.vercel.app`.
5. On the VM, put that URL into `CORS_ORIGINS` and `FRONTEND_URL` in `~/verimind/backend/.env`, then `pm2 restart verimind-api`.

### 6.8 Brevo (emails)

1. <https://www.brevo.com> → sign up.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender** → verify the email → `MAIL_FROM_EMAIL`.
3. **SMTP & API → API Keys → Generate a new API key** → `BREVO_API_KEY`.
4. Add both to `~/verimind/backend/.env` on the VM → `pm2 restart verimind-api`.

Until then, verification codes appear in `pm2 logs verimind-api`.

### 6.9 Google sign-in

1. <https://console.cloud.google.com> → create project `VeriMind`.
2. **APIs & Services → OAuth consent screen** → External → app name, support email → save → **Publish app**.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
   **Authorized JavaScript origins:** `http://localhost:5173` and `https://<your-project>.vercel.app`. No redirect URI needed.
4. Copy the **Client ID**:
   - VM: `GOOGLE_CLIENT_ID=...` in `backend/.env` → `pm2 restart verimind-api`
   - Vercel: `VITE_GOOGLE_CLIENT_ID` → **Deployments → Redeploy**

### 6.10 Automatic deployments from GitHub

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `ORACLE_HOST` | VM public IP |
| `ORACLE_USER` | `ubuntu` |
| `ORACLE_SSH_KEY` | the **entire contents** of `ssh-key-verimind.key` (including the `-----BEGIN…` / `-----END…` lines) |

Test it: GitHub → **Actions → Deploy backend to Oracle Cloud → Run workflow**. It runs the backend tests, SSHes into the VM and runs `deploy/oracle/deploy.sh` (git pull → npm ci → pm2 reload).

From now on: every push to `main` that changes `backend/` redeploys the API; every push redeploys the frontend on Vercel.

### 6.11 UptimeRobot (monitoring)

<https://uptimerobot.com> → **Add New Monitor** → HTTP(s) → URL `https://<ip-with-dashes>.sslip.io/health` → interval 5 minutes → alert contact: your email → **Create**.

### 6.12 Final checklist

- [ ] `https://<ip>.sslip.io/health` → `db: ok`, `llm.loaded: true`
- [ ] Vercel site opens; ☀ / ◐ / ☾ theme switch works; top-right shows **Live**
- [ ] Register → code email arrives → verify → Agent page
- [ ] *Continue with Google* works
- [ ] "What is 48731 multiplied by 9257?" → live steps → calculator verification
- [ ] "Is it safe to take it with alcohol?" → clarifying question
- [ ] Fabricated question → escalation in **Review queue** (admin) + email
- [ ] GitHub Action run is green

---

## 7. After deployment

**Update the app** (from your PC):
```bash
git add .
git commit -m "Describe your change"
git push
```

**Useful commands on the VM**

| Command | Does |
|---|---|
| `pm2 status` | is the API running? memory/CPU |
| `pm2 logs verimind-api` | live logs (Ctrl+C to exit) |
| `pm2 restart verimind-api` | restart after editing `.env` |
| `bash ~/verimind/deploy/oracle/deploy.sh` | manual deploy (pull + install + restart) |
| `free -h` | memory usage |
| `sudo systemctl status caddy` | HTTPS proxy status |
| `sudo journalctl -u caddy -n 50` | HTTPS / certificate logs |

The API starts automatically after a VM reboot (pm2 startup) and Caddy renews the HTTPS certificate automatically.

**Roles** — emails in `ADMIN_EMAILS` become admin on every start; admins promote others on the **Users** page (reviewer / admin).

**Backups** — Neon keeps point-in-time history (Neon dashboard → Restore). The VM holds no data except `.env` and the model.

**Keep the VM "active"** — Oracle may reclaim Always Free instances that sit almost completely idle for 7 days. Normal use plus the UptimeRobot checks usually avoid this; if you get an idle warning email, simply use the app.

---

## 8. Performance expectations

| Where | Hardware | Time per trust-aware answer |
|---|---|---|
| Your laptop (4 threads, CPU) | measured | ~4–5 min (each model call 12–100 s) |
| Oracle A1 VM, 4 Arm cores | CPU | a few minutes (similar or faster than the laptop) |
| Machine with a ≥ 4 GB GPU (`LLM_GPU=auto`) | GPU | seconds per call |

The agent makes ~6–8 model calls per question; every step streams live to the UI. Tips: keep `LLM_SAMPLES=1`; use **Baseline** mode for quick demos; run evaluations by category (`npm run eval -- tool`).

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

### Oracle Cloud / production

| Problem | Fix |
|---|---|
| "Out of capacity" when creating the VM | Retry later, pick another Availability Domain, or use 2 OCPU / 12 GB. |
| `ssh: Permission denied (publickey)` | Use `-i <key file>` and user `ubuntu`; on Windows run the `icacls` command from 6.3a. |
| `ssh` times out | Instance not running, wrong IP, or no public IP assigned. |
| `/health` doesn't load in the browser | Ingress rules for 80/443 missing (6.2c); check `sudo systemctl status caddy`. |
| Caddy log: certificate / ACME errors | Port 80 must be reachable from the internet (6.2c) — Let's Encrypt validates over it. |
| `pm2 logs` shows `Local model not found` | Model not at `~/verimind/LLM.gguf` — redo 6.4. |
| `pm2 logs` shows database errors | Fix `DATABASE_URL` in `backend/.env`, then `pm2 restart verimind-api`. |
| Browser console: CORS error | `CORS_ORIGINS` must exactly equal the Vercel URL (`https://…vercel.app`, no trailing slash) → restart. |
| Socket shows **Offline** in production | Same CORS issue; or open `/health` once to confirm HTTPS works. |
| Google: "origin not allowed" | Add the exact Vercel URL to the OAuth client's Authorized JavaScript origins. |
| No emails | `BREVO_API_KEY` and verified `MAIL_FROM_EMAIL` in `.env`? Look for `[email] Brevo error` in `pm2 logs`. |
| GitHub Action: "Add ORACLE_HOST…" | Add the three secrets from 6.10. |
| GitHub Action: SSH authentication failed | `ORACLE_SSH_KEY` must contain the full private key, including BEGIN/END lines. |
| `bash\r: No such file or directory` on the VM | Script got Windows line endings — `.gitattributes` prevents this; run `sed -i 's/\r$//' deploy/oracle/*.sh`. |
| `git push` rejected: file too large | `LLM.gguf` was committed: `git rm --cached LLM.gguf && git commit -m "Remove model" && git push`. |

---

More documentation: [README.md](README.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/API.md](docs/API.md) · [docs/CONFIDENCE_SCORING.md](docs/CONFIDENCE_SCORING.md) · [docs/EVALUATION.md](docs/EVALUATION.md) · [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)
