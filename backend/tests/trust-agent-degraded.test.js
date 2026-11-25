// The trust agent must still answer when optional checks fail (e.g. the free LLM API is rate-limited).
process.env.DATABASE_URL ||= 'postgres://localhost/test';
process.env.JWT_SECRET ||= 'test-secret';
process.env.LLM_PROVIDER = 'mistral';
process.env.LLM_API_KEY = 'test-key';
process.env.LLM_API_MIN_INTERVAL_MS = '0';

import { test } from 'node:test';
import assert from 'node:assert/strict';

const ok = (obj) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(obj) } }] }), { status: 200 });
const rateLimited = () => new Response('{"message":"Rate limit exceeded"}', { status: 429 });

// Answer by stage (recognised from the system prompt); judges and samples always fail with 429.
globalThis.fetch = async (url, init) => {
  if (String(url).includes('wikipedia')) return new Response(JSON.stringify({ query: { search: [] } }), { status: 200 });
  const { messages } = JSON.parse(init.body);
  const system = messages[0].content;
  if (system.includes('query-analysis stage')) {
    return ok({ ambiguity: 0, ambiguity_reason: '', clarifying_question: '', domain: 'general', high_stakes: false, needs_calculation: true, math_expression: '6 * 7', requires_current_info: false, search_queries: [] });
  }
  if (system.includes('Reason independently') || system.includes('compare independent answers') || system.includes('fact-checker')) {
    return rateLimited();
  }
  return ok({ answer: '42', confidence: 0.95, key_claims: ['6 times 7 is 42'], missing_information: [], numeric_answer: 42 });
};

// Make retries instant for the test.
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, _ms, ...args) => realSetTimeout(fn, 0, ...args);

const { runTrustAgent } = await import('../src/agent/trustAgent.js');

test('agent answers with degraded confidence when checks are rate-limited', async () => {
  const result = await runTrustAgent('What is 6 times 7?');
  assert.equal(result.answer, '42');
  assert.notEqual(result.route, undefined);
  const codes = result.explanation.map((f) => f.code);
  assert.ok(codes.includes('VERIFICATION_UNAVAILABLE'), `expected degraded factor, got ${codes}`);
  assert.ok(codes.includes('VERIFIED_BY_TOOL'));
  assert.ok(result.steps.some((s) => s.status === 'failed'));
});
