/**
 * Offline evaluation: baseline vs. trust-aware agent.
 *   npm run eval                      # full dataset
 *   npm run eval -- factual tool      # only some categories
 * Writes a JSON report to ./reports/. Needs ANTHROPIC_API_KEY (DATABASE_URL/JWT_SECRET only for config loading).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { DATASET } from '../src/eval/dataset.js';
import { runEvaluation } from '../src/eval/runner.js';

const categories = process.argv.slice(2);
const items = categories.length ? DATASET.filter((d) => categories.includes(d.category)) : DATASET;
console.log(`Evaluating ${items.length} scenarios...`);

const { results, summary } = await runEvaluation({
  items,
  onResult: (r) =>
    console.log(
      `${r.item.id.padEnd(4)} baseline=${r.baseline.verdict.padEnd(9)} trust=${r.trust.verdict.padEnd(9)} route=${r.trust.route.padEnd(10)} conf=${r.trust.confidence?.toFixed(2)}`,
    ),
});

const pct = (n) => `${(n * 100).toFixed(1)}%`;
const rows = ['accuracy', 'hallucinationRate', 'failedDecisionRate', 'unnecessaryEscalationRate', 'escalationRate'];
console.log('\nMetric                       Baseline   Trust-aware');
for (const k of rows) console.log(`${k.padEnd(28)} ${pct(summary.baseline[k]).padStart(8)}   ${pct(summary.trust[k]).padStart(8)}`);
console.log(`${'avgLatencyMs'.padEnd(28)} ${summary.baseline.avgLatencyMs.toFixed(0).padStart(8)}   ${summary.trust.avgLatencyMs.toFixed(0).padStart(8)}`);
if (summary.trust.ece !== undefined) console.log(`Trust agent ECE=${summary.trust.ece.toFixed(3)} Brier=${summary.trust.brier.toFixed(3)}`);

await mkdir('reports', { recursive: true });
const file = `reports/eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(file, JSON.stringify({ summary, results }, null, 2));
console.log(`\nReport written to ${file}`);
