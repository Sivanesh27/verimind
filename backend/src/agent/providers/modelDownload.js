/**
 * Cloud hosts cannot receive a 3 GB model through git, so the server can download it on first boot
 * from LLM_MODEL_URL (e.g. a Hugging Face "resolve" link) into LLM_MODEL_PATH (put that on a persistent disk).
 */
import { createWriteStream, existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { env } from '../../config/env.js';

export async function ensureModelFile() {
  const { modelPath, modelUrl } = env.local;
  if (existsSync(modelPath) || !modelUrl) return;

  console.log(`[llm] model not found, downloading from ${new URL(modelUrl).host} ...`);
  mkdirSync(dirname(modelPath), { recursive: true });
  // A token is only needed if the model sits in a private Hugging Face repo.
  const headers = env.local.modelToken ? { Authorization: `Bearer ${env.local.modelToken}` } : {};
  const res = await fetch(modelUrl, { headers });
  if (!res.ok || !res.body) throw new Error(`Model download failed: HTTP ${res.status}`);

  const total = Number(res.headers.get('content-length')) || 0;
  let received = 0;
  let lastLog = 0;
  const body = Readable.fromWeb(res.body);
  body.on('data', (chunk) => {
    received += chunk.length;
    if (total && received - lastLog > total / 20) {
      lastLog = received;
      console.log(`[llm] download ${Math.round((received / total) * 100)}%`);
    }
  });
  const tmp = `${modelPath}.part`;
  await pipeline(body, createWriteStream(tmp));
  renameSync(tmp, modelPath); // only a complete file ever appears at modelPath
  console.log('[llm] model download complete');
}
