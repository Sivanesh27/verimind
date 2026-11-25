/**
 * Traditional agent used as the evaluation control: one call, always answers, no self-doubt.
 */
import { complete } from './llm.js';
import { BASELINE_SYSTEM } from './prompts.js';

export async function runBaselineAgent(query) {
  const started = Date.now();
  const answer = await complete({ system: BASELINE_SYSTEM, prompt: query, effort: 'medium' });
  return { route: 'answer', answer, latencyMs: Date.now() - started };
}
