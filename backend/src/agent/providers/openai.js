/**
 * Hosted LLM provider for any OpenAI-compatible Chat Completions API.
 * Default: Mistral AI's API (free "Experiment" plan, no card needed) — https://api.mistral.ai/v1
 * Also works with Groq, OpenRouter, or a llama.cpp server running your own GGUF (`llama-server --api`).
 *
 * Structured outputs: the request asks for a JSON-schema response (falls back to plain JSON mode if the
 * server doesn't support schemas); the reply is always validated with Zod and retried once on bad JSON.
 * Free tiers are rate-limited (~1 request/second), so calls are queued and spaced, and 429s are retried.
 */
import { z } from 'zod';
import { env } from '../../config/env.js';

const MAX_TOKENS = { low: 500, medium: 900, high: 1400 };
const MAX_RETRIES = 8;
const MAX_BACKOFF_MS = 20_000;

let queue = Promise.resolve();
let lastCallAt = 0;
let cooldownUntil = 0; // after a 429, every queued call waits until this time
let schemaModeSupported = env.api.jsonMode === 'json_schema';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Serialise requests, keep at least LLM_API_MIN_INTERVAL_MS between them, and honour rate-limit cooldowns. */
function throttled(fn) {
  const run = queue.then(async () => {
    const wait = Math.max(lastCallAt + env.api.minIntervalMs, cooldownUntil) - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      lastCallAt = Date.now();
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

async function chat(body) {
  if (!env.api.key) throw new Error('LLM_API_KEY is not set');
  for (let attempt = 0; ; attempt++) {
    const res = await throttled(() =>
      fetch(`${env.api.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${env.api.key}` },
        body: JSON.stringify({ model: env.api.model, ...body }),
        signal: AbortSignal.timeout(120_000),
      }),
    );
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    }
    const retryable = res.status === 429 || res.status >= 500;
    const text = await res.text().catch(() => '');
    if (!retryable || attempt >= MAX_RETRIES) {
      const err = new Error(`LLM API error ${res.status}: ${text.slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    const retryAfter = Number(res.headers.get('retry-after'));
    const backoff = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(MAX_BACKOFF_MS, 2000 * 2 ** attempt) + Math.random() * 500;
    // Pause the whole queue, not just this call: other queued calls would hit the same limit.
    if (res.status === 429) cooldownUntil = Math.max(cooldownUntil, Date.now() + backoff);
    console.warn(`[llm] API ${res.status}, retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(backoff / 1000)}s`);
    await sleep(backoff);
  }
}

const messages = (system, prompt) => [
  { role: 'system', content: system },
  { role: 'user', content: prompt },
];

/** Pull the first JSON object out of a reply (some models wrap JSON in prose or code fences). */
export function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object in model output');
  return JSON.parse(text.slice(start, end + 1));
}

export async function structured({ system, prompt, schema, effort = 'medium', temperature = 0.2 }) {
  const jsonSchema = z.toJSONSchema(schema);
  delete jsonSchema.$schema;
  const sys = `${system}\n\nRespond ONLY with a JSON object that matches this JSON schema:\n${JSON.stringify(jsonSchema)}`;
  const base = { messages: messages(sys, prompt), temperature, max_tokens: MAX_TOKENS[effort] ?? MAX_TOKENS.medium };

  const request = async () => {
    if (schemaModeSupported) {
      try {
        return await chat({ ...base, response_format: { type: 'json_schema', json_schema: { name: 'output', schema: jsonSchema, strict: true } } });
      } catch (err) {
        if (err.status !== 400 && err.status !== 422) throw err;
        schemaModeSupported = false; // server doesn't support schemas: use plain JSON mode from now on
        console.warn('[llm] json_schema not supported by this API, falling back to json_object');
      }
    }
    return chat({ ...base, response_format: { type: 'json_object' } });
  };

  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return schema.parse(normalise(extractJson(await request())));
    } catch (err) {
      if (err.status) throw err; // HTTP errors are not fixed by asking again
      lastError = err;
    }
  }
  throw new Error(`Model returned invalid JSON: ${lastError.message}`);
}

/** Models sometimes send numbers as strings ("0.8") — coerce top-level numeric strings. */
function normalise(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()) && /confidence|support|agreement|ambiguity|numeric/.test(k)) {
      out[k] = Number(v);
    }
  }
  return out;
}

export async function complete({ system, prompt, effort = 'medium', temperature = 0.3 }) {
  const text = await chat({ messages: messages(system, prompt), temperature, max_tokens: MAX_TOKENS[effort] ?? MAX_TOKENS.medium });
  return text.trim();
}

export const describe = () => ({ provider: 'api', model: env.api.model, host: new URL(env.api.baseUrl).host });
