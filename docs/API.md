# API reference

Base URL: `https://<hf-username>-verimind-api.hf.space` (local: `http://localhost:8080`).
All bodies are JSON. Authenticated endpoints need `Authorization: Bearer <jwt>`.
Errors: `{ "error": "message", "details": ... }` with a 4xx/5xx status.

## Health

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{ status, db, llm, uptime, time }` — 503 if the database is unreachable. Used by UptimeRobot. |

## Auth — `/api/auth`

Rate limited to 50 requests / 15 min / IP.

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/register` | `{ name, email, password }` | `201 { message, email }` — emails a 6-digit code |
| POST | `/verify-email` | `{ email, code }` | `{ token, user }` |
| POST | `/resend-code` | `{ email, purpose: "verify" \| "reset" }` | `{ message }` |
| POST | `/login` | `{ email, password }` | `{ token, user }`; `403 details.code = EMAIL_NOT_VERIFIED` (new code sent) |
| POST | `/google` | `{ credential }` (Google ID token) | `{ token, user }` — creates or links the account |
| POST | `/forgot-password` | `{ email }` | `{ message }` (always 200) |
| POST | `/reset-password` | `{ email, code, password }` | `{ token, user }` |
| GET | `/me` | — | `{ user }` |

`user = { id, email, name, avatar_url, role, email_verified }`

## Agent — `/api/agent` (auth)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/ask` | `{ query, mode?: "trust" \| "baseline", parentRunId? }` | `202 { run }` — runs in background; follow via socket |
| GET | `/runs` | — | `{ runs }` — your 50 latest runs |
| GET | `/runs/:id` | — | `{ run }` (owner, reviewer or admin) |

`parentRunId` answers a run whose route was `clarify`.
Limits: 2 concurrent runs per user, 60 questions / hour.

**Run object**

```json
{
  "id": "uuid",
  "query": "What is 48731 multiplied by 9257?",
  "mode": "trust",
  "status": "completed | running | failed | awaiting_review | reviewed",
  "route": "answer | verify | clarify | specialist | escalate",
  "confidence": 0.93,
  "level": "high | medium | low",
  "answer": "451,102,867",
  "explanation": [{ "code": "VERIFIED_BY_TOOL", "label": "Verified by tool", "severity": "positive", "detail": "..." }],
  "signals": {
    "values": { "selfAssessment": 0.95, "consistency": 1, "evidence": null, "sourceReliability": 1, "toolVerification": 1, "clarity": 1 },
    "contributions": [{ "signal": "toolVerification", "label": "Tool verification", "value": 1, "weight": 0.3, "share": 0.36 }],
    "caps": [],
    "analysis": { "domain": "general", "ambiguity": 0, "high_stakes": false, "...": "..." },
    "path": ["answer"]
  },
  "steps": [{ "key": "analyze", "label": "Analyzing query", "status": "done", "detail": "...", "durationMs": 1200 }],
  "sources": [{ "title": "...", "url": "...", "source": "wikipedia", "reliability": 0.8, "snippet": "..." }],
  "latency_ms": 9400,
  "answered_by": "human"
}
```

For escalated runs the user receives a hand-off message until a reviewer answers; then `answer` is the reviewer's text and `answered_by = "human"`.

## Escalations — `/api/escalations` (reviewer, admin)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/?status=open\|resolved\|dismissed` | — | `{ escalations }` (includes query, confidence, draft answer, explanation, user) |
| POST | `/:id/resolve` | `{ action: "resolve" \| "dismiss", resolution }` | `{ escalation }` — notifies the user live + email |

## Monitoring — `/api/monitor` (auth)

| Method | Path | Response |
|---|---|---|
| GET | `/stats?days=30&scope=mine\|all` | `{ stats: { total, avg_confidence, avg_latency_ms, failed, routes[], daily[], histogram[] }, escalations?, thresholds }` — `scope=all` for staff only |
| GET | `/recent` | `{ runs }` — staff see everyone's latest runs |

## Evaluation — `/api/eval` (auth)

| Method | Path | Response |
|---|---|---|
| GET | `/dataset` | `{ dataset, categories }` |
| GET | `/runs` | `{ runs, running }` |
| GET | `/runs/:id` | `{ run }` with `results[]` and `summary` |
| POST | `/runs` (admin) | body `{ categories? }` → `202 { run }`; one evaluation at a time |

## Admin — `/api/admin` (admin)

| Method | Path | Body |
|---|---|---|
| GET | `/users` | — |
| PATCH | `/users/:id/role` | `{ role: "user" \| "reviewer" \| "admin" }` |

## Socket.IO

Connect to the API origin with `io(API_URL, { auth: { token } })`. Rooms are joined automatically: `user:<id>`, `monitor`, and `reviewers` for staff.

| Event | Room | Payload |
|---|---|---|
| `run:step` | user | `{ runId, step }` — a step started (`running`) or finished (`done`/`failed`) |
| `run:complete` | user | run object |
| `run:reviewed` | user | run object with the reviewer's answer |
| `monitor:run-started` | monitor | `{ id, query, mode, userName, createdAt }` |
| `monitor:run-completed` | monitor | run summary |
| `escalation:new` | reviewers | escalation + query + confidence |
| `escalation:updated` | reviewers | escalation |
| `eval:started` / `eval:progress` / `eval:completed` / `eval:failed` | monitor | `{ id, result? , summary?, error? }` |
