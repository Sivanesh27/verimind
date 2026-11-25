// Tests the hosted-API provider against a mocked fetch (no network, no key needed).
process.env.DATABASE_URL ||= 'postgres://localhost/test';
process.env.JWT_SECRET ||= 'test-secret';
process.env.LLM_API_KEY = 'test-key';
process.env.LLM_API_MIN_INTERVAL_MS = '0';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

const { structured, complete, extractJson } = await import('../src/agent/providers/openai.js');

const Schema = z.object({ answer: z.string(), confidence: z.number() });
const reply = (content, status = 200) =>
  new Response(JSON.stringify(status === 200 ? { choices: [{ message: { content } }] } : { error: content }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function mockFetch(responses) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return responses.shift();
  };
  return calls;
}

test('extractJson tolerates prose and code fences', () => {
  assert.deepEqual(extractJson('Sure!\n```json\n{"a": 1}\n```'), { a: 1 });
  assert.throws(() => extractJson('no json here'));
});

test('structured() sends a JSON-schema request and validates the reply', async () => {
  const calls = mockFetch([reply('{"answer":"Canberra","confidence":0.95}')]);
  const out = await structured({ system: 'sys', prompt: 'capital of Australia?', schema: Schema });
  assert.deepEqual(out, { answer: 'Canberra', confidence: 0.95 });
  assert.match(calls[0].url, /\/chat\/completions$/);
  assert.equal(calls[0].body.response_format.type, 'json_schema');
  assert.equal(calls[0].body.model, 'ministral-8b-latest');
});

test('structured() retries once when the model returns invalid JSON', async () => {
  const calls = mockFetch([reply('not json'), reply('{"answer":"W","confidence":"0.9"}')]);
  const out = await structured({ system: 's', prompt: 'p', schema: Schema });
  assert.equal(out.confidence, 0.9); // numeric string coerced
  assert.equal(calls.length, 2);
});

test('falls back to json_object mode when json_schema is rejected', async () => {
  const calls = mockFetch([reply('unsupported response_format', 400), reply('{"answer":"x","confidence":1}')]);
  await structured({ system: 's', prompt: 'p', schema: Schema });
  assert.equal(calls[1].body.response_format.type, 'json_object');
});

test('retries on 429 rate limits', async () => {
  const limited = new Response('{}', { status: 429, headers: { 'retry-after': '0.01' } });
  mockFetch([limited, reply('plain text answer')]);
  assert.equal(await complete({ system: 's', prompt: 'p' }), 'plain text answer');
});
