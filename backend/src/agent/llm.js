/**
 * LLM facade. The agent only ever calls `structured()` and `complete()`; the provider is chosen by LLM_PROVIDER:
 *   api        OpenAI-compatible hosted API — default Mistral AI (free Experiment plan). Aliases: mistral, openai
 *   local      the GGUF model in the project root (LLM.gguf), run in-process with node-llama-cpp
 *   anthropic  Claude via the Anthropic API
 */
import { env } from '../config/env.js';

export { LlmRefusalError } from './providers/errors.js';

const name = env.llmProvider;
const provider =
  name === 'local'
    ? await import('./providers/local.js')
    : name === 'anthropic'
      ? await import('./providers/anthropic.js')
      : await import('./providers/openai.js');

export const isLocal = name === 'local';

/**
 * True when the provider processes one call at a time (local CPU model, or a rate-limited free API).
 * The agent then uses fewer self-consistency samples and evaluations run one scenario at a time.
 */
export const isSerial = name !== 'anthropic';

/** @param {{system: string, prompt: string, schema: import('zod').ZodType, effort?: string, temperature?: number}} args */
export const structured = (args) => provider.structured(args);

/** @param {{system: string, prompt: string, effort?: string, temperature?: number}} args */
export const complete = (args) => provider.complete(args);

/** Load the local model at boot so the first question doesn't pay the load time. */
export const warmUp = () => (isLocal ? provider.warmUp() : Promise.resolve());

export const describeLlm = () => (name === 'anthropic' ? { provider: 'anthropic', model: env.model } : provider.describe());
