process.env.DATABASE_URL ||= 'postgres://localhost/test';
process.env.JWT_SECRET ||= 'test-secret';

import { test } from 'node:test';
import assert from 'node:assert/strict';
const { scoreConfidence, explainConfidence } = await import('../src/agent/confidence.js');
const { decideRoute } = await import('../src/agent/router.js');
const { calibration } = await import('../src/eval/metrics.js');
const { calculate, numbersMatch } = await import('../src/agent/tools/calculator.js');

const strong = { selfAssessment: 0.95, consistency: 0.95, evidence: 0.9, sourceReliability: 0.8, toolVerification: null, clarity: 1 };

test('strong signals produce high confidence', () => {
  const r = scoreConfidence(strong);
  assert.equal(r.level, 'high');
  assert.ok(r.score > 0.85);
});

test('null signals are ignored and weights re-normalised', () => {
  const r = scoreConfidence({ ...strong, evidence: null, sourceReliability: null });
  assert.equal(r.contributions.length, 3);
  assert.ok(r.score > 0.9);
});

test('failed tool verification caps confidence', () => {
  const r = scoreConfidence({ ...strong, toolVerification: 0 });
  assert.equal(r.score, 0.3);
  assert.equal(r.level, 'low');
  assert.match(r.caps[0].reason, /Tool verification/);
});

test('contradicting evidence caps confidence', () => {
  const r = scoreConfidence(strong, { contradiction: true });
  assert.ok(r.score <= 0.4);
});

test('high-stakes queries need a stricter threshold', () => {
  const signals = { ...strong, selfAssessment: 0.85, consistency: 0.85, evidence: 0.85 };
  assert.equal(scoreConfidence(signals).level, 'high');
  assert.equal(scoreConfidence(signals, { highStakes: true }).level, 'medium');
});

test('explanation surfaces ambiguity and failed verification', () => {
  const factors = explainConfidence({
    signals: { ...strong, clarity: 0.3, toolVerification: 0 },
    analysis: { ambiguity_reason: 'No destination given' },
    tool: { ok: true, value: 42 },
    sources: [],
  });
  const codes = factors.map((f) => f.code);
  assert.ok(codes.includes('AMBIGUOUS_QUERY'));
  assert.ok(codes.includes('FAILED_VERIFICATION'));
  assert.equal(factors[0].severity, 'high');
});

test('router decisions', () => {
  const analysis = { ambiguity: 0.1, domain: 'general', high_stakes: false };
  assert.equal(decideRoute({ level: 'high', analysis }), 'answer');
  assert.equal(decideRoute({ level: 'medium', analysis }), 'verify');
  assert.equal(decideRoute({ level: 'medium', analysis, verified: true }), 'answer');
  assert.equal(decideRoute({ level: 'low', analysis: { ...analysis, ambiguity: 0.8, clarifying_question: 'Which city?' } }), 'clarify');
  assert.equal(decideRoute({ level: 'low', analysis }), 'verify');
  assert.equal(decideRoute({ level: 'low', analysis, verified: true }), 'escalate');
  const medical = { ...analysis, domain: 'medical', high_stakes: true };
  assert.equal(decideRoute({ level: 'low', analysis: medical, verified: true }), 'specialist');
  assert.equal(decideRoute({ level: 'low', analysis: medical, verified: true, specialistTried: true }), 'escalate');
});

test('calculator and numeric matching', () => {
  assert.deepEqual(calculate('48731 * 9257'), { ok: true, value: 451102867 });
  assert.equal(calculate('import({})').ok, false);
  assert.ok(numbersMatch(405.365, 405.36500001));
  assert.ok(!numbersMatch(100, 101));
});

test('calibration: perfect predictions give zero ECE', () => {
  const rows = [
    { confidence: 1, route: 'answer', verdict: 'correct', item: { type: 'answerable' } },
    { confidence: 0, route: 'answer', verdict: 'incorrect', item: { type: 'answerable' } },
  ];
  const c = calibration(rows);
  assert.equal(c.ece, 0);
  assert.equal(c.brier, 0);
});
