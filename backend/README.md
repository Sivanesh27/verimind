# VeriMind API

Express + Socket.IO backend hosting the trust-aware agent, evaluation harness, auth and human review queue.

```bash
cp .env.example .env   # fill in values
npm install
npm run dev            # http://localhost:8080
npm test
```

```
src/
├── server.js          boot: migrate → HTTP + Socket.IO
├── app.js             Express app, middleware, routes, /health
├── agent/             trustAgent, baselineAgent, confidence, router, prompts, schemas, llm, tools/
├── eval/              dataset, runner, metrics
├── routes/            auth, agent, escalation, eval, monitor, admin
├── services/          agent + eval orchestration, email (Brevo), tokens, Google
├── repositories/      SQL data access
├── realtime/          Socket.IO server and rooms
├── middleware/        auth guards, error handling
├── db/                schema.sql, pool, migrate
└── config/env.js      validated environment
scripts/run-eval.js    CLI evaluation
tests/                 node:test unit tests
```

See the root [README](../README.md) and [docs/](../docs) for architecture, API and deployment.
