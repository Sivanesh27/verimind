import http from 'node:http';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { migrate } from './db/migrate.js';
import { pool } from './db/pool.js';
import { initSocket } from './realtime/socket.js';
import { failStaleEvalRuns } from './repositories/evals.repo.js';
import { promoteAdmins } from './repositories/users.repo.js';
import { warmUp } from './agent/llm.js';

async function main() {
  if (env.llmProvider === 'anthropic' && !env.anthropicApiKey) {
    console.warn('[boot] LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set — agent calls will fail');
  }
  if (env.llmProvider === 'api' && !env.api.key) {
    console.warn('[boot] LLM_PROVIDER=mistral but LLM_API_KEY is not set — agent calls will fail');
  }
  console.log(`[boot] LLM provider: ${env.llmProvider}${env.llmProvider === 'api' ? ` (${env.api.model} @ ${env.api.baseUrl})` : ''}`);
  await migrate();
  await failStaleEvalRuns();
  await promoteAdmins(env.adminEmails);

  const server = http.createServer(createApp());
  initSocket(server);
  server.listen(env.port, () => console.log(`[boot] VeriMind API listening on :${env.port} (${env.nodeEnv})`));

  // Load the local model in the background so the port opens immediately (health checks pass while it loads).
  warmUp().catch((err) => console.error('[llm] failed to load model:', err.message));

  const shutdown = (signal) => {
    console.log(`[boot] ${signal} received, shutting down`);
    server.close(() => pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[boot] fatal', err);
  process.exit(1);
});
