/**
 * LLM facade. The agent only ever calls `structured()` and `complete()`; the provider is chosen by LLM_PROVIDER:
 *   local     (default) the GGUF model in the project root, run in-process with node-llama-cpp
 *   anthropic           Claude via the Anthropic API (useful on small cloud instances)
 */
import { env } from '../config/env.js';
import * as local from './providers/local.js';

export { LlmRefusalError } from './providers/errors.js';

const provider = env.llmProvider === 'anthropic' ? await import('./providers/anthropic.js') : local;

/** @param {{system: string, prompt: string, schema: import('zod').ZodType, effort?: string, temperature?: number}} args */
export const structured = (args) => provider.structured(args);

/** @param {{system: string, prompt: string, effort?: string, temperature?: number}} args */
export const complete = (args) => provider.complete(args);

export const isLocal = env.llmProvider !== 'anthropic';

/** Load the local model at boot so the first question doesn't pay the load time. */
export const warmUp = () => (isLocal ? local.warmUp() : Promise.resolve());

export const describeLlm = () => (isLocal ? local.describe() : { provider: 'anthropic', model: env.model });
