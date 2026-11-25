import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { env } from '../../config/env.js';
import { LlmRefusalError } from './errors.js';

/** Optional cloud provider (LLM_PROVIDER=anthropic). */
const client = new Anthropic({ apiKey: env.anthropicApiKey, maxRetries: 3, timeout: 120_000 });

function checkStop(res) {
  if (res.stop_reason === 'refusal') throw new LlmRefusalError(res.stop_details?.category);
  if (res.stop_reason === 'max_tokens') throw new Error('Model output was truncated (max_tokens)');
}

/**
 * Call Claude and get back an object validated against a Zod schema (structured outputs).
 * `effort` trades depth for latency/cost: the agent uses "low" for cheap judging steps.
 */
export async function structured({ system, prompt, schema, effort = 'medium', maxTokens = 8000, model = env.model }) {
  const res = await client.messages.parse({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
    output_config: { effort, format: zodOutputFormat(schema) },
  });
  checkStop(res);
  if (!res.parsed_output) throw new Error('Model returned output that did not match the schema');
  return res.parsed_output;
}

/** Plain-text completion (used by the baseline agent). */
export async function complete({ system, prompt, effort = 'medium', maxTokens = 8000, model = env.model }) {
  const res = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
    output_config: { effort },
  });
  checkStop(res);
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}
