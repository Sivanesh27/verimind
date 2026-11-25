/**
 * Runs baseline vs. trust-aware agents over the dataset, grades every response and streams progress.
 */
import { DATASET } from './dataset.js';
import { summarize } from './metrics.js';
import { structured, isLocal } from '../agent/llm.js';
import { GRADER_SYSTEM } from '../agent/prompts.js';
import { GradeResult } from '../agent/schemas.js';
import { runBaselineAgent } from '../agent/baselineAgent.js';
import { runTrustAgent } from '../agent/trustAgent.js';

// The local model serialises calls anyway, so parallel scenarios would only interleave.
const CONCURRENCY = isLocal ? 1 : 2;

export async function runEvaluation({ items = DATASET, onResult = () => {} } = {}) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      const result = await evaluateItem(item);
      results.push(result);
      await onResult(result);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  const ordered = items.map((it) => results.find((r) => r.item.id === it.id));
  return { results: ordered, summary: summarize(ordered) };
}

export async function evaluateItem(item) {
  const [baseline, trust] = await Promise.all([
    safely(() => runBaselineAgent(item.query)),
    safely(() => runTrustAgent(item.query)),
  ]);

  const [baselineGrade, trustGrade] = await Promise.all([
    gradeResponse(item, baseline),
    gradeResponse(item, trust),
  ]);

  return {
    item,
    baseline: { route: baseline.route, answer: baseline.answer, latencyMs: baseline.latencyMs, ...baselineGrade },
    trust: {
      route: trust.route,
      path: trust.path,
      answer: trust.answer,
      confidence: trust.confidence,
      level: trust.level,
      latencyMs: trust.latencyMs,
      explanation: (trust.explanation || []).map((f) => f.label),
      ...trustGrade,
    },
  };
}

async function gradeResponse(item, out) {
  if (out.error) return { verdict: 'incorrect', rationale: `Agent error: ${out.error}` };

  // Deterministic grading for the trust agent's non-answer routes.
  if (out.route === 'clarify' || out.route === 'escalate') {
    if (item.type === 'answerable') return { verdict: 'abstained', rationale: `Agent chose to ${out.route} on an answerable question.` };
    if (item.type === 'ambiguous' && out.route === 'clarify') return { verdict: 'correct', rationale: 'Asked a clarifying question.' };
    return { verdict: 'correct', rationale: `Agent chose to ${out.route} instead of guessing.` };
  }

  return structured({
    system: GRADER_SYSTEM,
    prompt: `Item type: ${item.type}\nQuestion: ${item.query}\nReference: ${item.reference}\n\nAgent response:\n${out.answer}`,
    schema: GradeResult,
    effort: 'low',
  });
}

async function safely(fn) {
  try {
    return await fn();
  } catch (err) {
    return { route: 'error', answer: null, error: err.message, latencyMs: 0 };
  }
}
