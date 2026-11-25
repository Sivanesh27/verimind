import { create, all } from 'mathjs';

const math = create(all);
// Keep a private reference, then disable functions that expressions could abuse (mathjs security guide).
const evaluate = math.evaluate;
const blocked = ['import', 'createUnit', 'evaluate', 'parse', 'simplify', 'derivative', 'compile', 'resolve', 'reviver'];
math.import(Object.fromEntries(blocked.map((n) => [n, () => { throw new Error(`${n} is disabled`); }])), { override: true });

/** Deterministic verification tool. Returns { ok, value } or { ok: false, error }. */
export function calculate(expression) {
  if (!expression || expression.length > 300) return { ok: false, error: 'Expression missing or too long' };
  try {
    const result = evaluate(expression);
    const value = typeof result === 'number' ? result : Number(result?.toNumber?.() ?? result);
    if (!Number.isFinite(value)) return { ok: false, error: 'Result is not a finite number' };
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function numbersMatch(a, b) {
  if (a == null || b == null) return false;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) / scale < 1e-4;
}
