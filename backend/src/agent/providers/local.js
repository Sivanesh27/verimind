/**
 * Local LLM provider: runs a GGUF model (default: ../LLM.gguf, Mistral 7B Instruct v0.2) in-process with
 * node-llama-cpp. Structured outputs are enforced with a JSON-schema grammar, so the model can only emit
 * tokens that form valid JSON for the requested schema.
 *
 * The model has one context sequence, so calls are serialised through a queue. Concurrent agent stages
 * still work — they simply wait their turn.
 */
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { ensureModelFile } from './modelDownload.js';

const MAX_TOKENS = { low: 350, medium: 600, high: 900 };
const MAX_ARRAY_ITEMS = 4; // keeps lists short: fewer tokens = faster on CPU

let loading = null;
let queue = Promise.resolve();
const grammarCache = new WeakMap();

/** Load the model once (lazily, or eagerly at boot via warmUp). */
function load() {
  loading ||= (async () => {
    await ensureModelFile();
    if (!existsSync(env.local.modelPath)) throw new Error(`Local model not found at ${env.local.modelPath}`);
    const { getLlama } = await import('node-llama-cpp');
    const t0 = Date.now();
    const llama = await getLlama({ gpu: env.local.gpu });
    const model = await llama.loadModel({ modelPath: env.local.modelPath });
    const context = await model.createContext({ contextSize: env.local.contextSize, threads: env.local.threads || undefined });
    const sequence = context.getSequence();
    console.log(`[llm] local model loaded in ${Date.now() - t0}ms (gpu=${llama.gpu || 'none'}, ctx=${env.local.contextSize})`);
    return { llama, model, context, sequence };
  })().catch((err) => {
    loading = null; // allow a retry on the next call
    throw err;
  });
  return loading;
}

export const warmUp = () => load().then(() => undefined);

/** Run `fn` exclusively on the single context sequence. */
function exclusive(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function generate({ system, prompt, grammar, maxTokens, temperature }) {
  const { sequence } = await load();
  const { LlamaChatSession } = await import('node-llama-cpp');
  return exclusive(async () => {
    await sequence.clearHistory(); // every call is an independent conversation
    const session = new LlamaChatSession({ contextSequence: sequence, systemPrompt: system });
    try {
      return await session.prompt(prompt, { grammar, maxTokens, temperature });
    } finally {
      session.dispose({ disposeSequence: false });
    }
  });
}

/** Convert a Zod schema to the JSON-schema subset that node-llama-cpp grammars support. */
export function toGrammarSchema(schema) {
  const json = z.toJSONSchema(schema);
  const walk = (node) => {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(walk);
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === '$schema') continue;
      if (k === 'anyOf') out.oneOf = walk(v);
      else out[k] = walk(v);
    }
    if (out.type === 'array' && out.maxItems === undefined) out.maxItems = MAX_ARRAY_ITEMS;
    return out;
  };
  return walk(json);
}

async function grammarFor(schema) {
  if (!grammarCache.has(schema)) {
    const { llama } = await load();
    grammarCache.set(schema, await llama.createGrammarForJsonSchema(toGrammarSchema(schema)));
  }
  return grammarCache.get(schema);
}

export async function structured({ system, prompt, schema, effort = 'medium', temperature = 0.2 }) {
  const grammar = await grammarFor(schema);
  const text = await generate({
    system: `${system}\nRespond only with JSON matching the required format.`,
    prompt,
    grammar,
    maxTokens: MAX_TOKENS[effort] ?? MAX_TOKENS.medium,
    temperature,
  });
  let parsed;
  try {
    parsed = grammar.parse(text);
  } catch {
    throw new Error('Local model produced incomplete JSON (try raising the token limit)');
  }
  return schema.parse(parsed);
}

export async function complete({ system, prompt, effort = 'medium', temperature = 0.3 }) {
  const text = await generate({ system, prompt, maxTokens: MAX_TOKENS[effort] ?? MAX_TOKENS.medium, temperature });
  return text.trim();
}

export const describe = () => ({ provider: 'local', model: env.local.modelName, loaded: loading !== null });
