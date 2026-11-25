/**
 * Metric definitions (per agent):
 *  accuracy                 correct / total
 *  hallucinationRate        confidently wrong answers on answerable + unanswerable items / those items
 *  failedDecisionRate       incorrect (any category, including answering ambiguous questions) / total
 *  unnecessaryEscalation    abstained (clarify/escalate/decline) on answerable items / answerable items
 *  escalationRate           escalate routes / total
 *  clarificationRate        clarify routes / total
 *  avgLatencyMs             mean wall-clock time
 *  ece / brier              calibration of the confidence score against correctness (trust agent only)
 *  verification             share of runs that went through verification and how often they ended correct
 */
export function computeMetrics(results, key) {
  const rows = results.map((r) => ({ ...r[key], item: r.item }));
  const n = rows.length || 1;
  const answerable = rows.filter((r) => r.item.type === 'answerable');
  const factualish = rows.filter((r) => r.item.type !== 'ambiguous');

  const correct = rows.filter((r) => r.verdict === 'correct').length;
  const incorrect = rows.filter((r) => r.verdict === 'incorrect').length;
  const hallucinated = factualish.filter((r) => r.verdict === 'incorrect').length;
  const abstainedAnswerable = answerable.filter((r) => r.verdict === 'abstained').length;

  const metrics = {
    total: rows.length,
    accuracy: correct / n,
    hallucinationRate: factualish.length ? hallucinated / factualish.length : 0,
    failedDecisionRate: incorrect / n,
    unnecessaryEscalationRate: answerable.length ? abstainedAnswerable / answerable.length : 0,
    escalationRate: rows.filter((r) => r.route === 'escalate').length / n,
    clarificationRate: rows.filter((r) => r.route === 'clarify').length / n,
    avgLatencyMs: rows.reduce((a, r) => a + (r.latencyMs || 0), 0) / n,
  };

  const scored = rows.filter((r) => typeof r.confidence === 'number');
  if (scored.length) {
    Object.assign(metrics, calibration(scored));
    const verified = scored.filter((r) => r.path?.includes('verify'));
    metrics.verification = {
      runs: verified.length,
      correctAfterVerification: verified.filter((r) => r.verdict === 'correct').length,
    };
  }
  return metrics;
}

/**
 * Calibration: does the confidence score predict whether the agent's answer is trustworthy?
 *  - Delivered answers: outcome = 1 if graded correct, else 0.
 *  - Withheld answers (clarify / escalate): outcome = 1 only if the item was actually answerable
 *    (so low confidence on an unanswerable or ambiguous item counts as well calibrated).
 * Reports Expected Calibration Error (ECE), Brier score and a reliability table.
 */
export function calibration(rows, bins = 5) {
  const points = rows.map((r) => {
    const delivered = r.route === 'answer' || r.route === 'specialist';
    // Outcome: was the underlying answer trustworthy? Delivered answers use the verdict; withheld answers are
    // treated as untrustworthy when the item was not answerable, trustworthy otherwise.
    const outcome = delivered ? (r.verdict === 'correct' ? 1 : 0) : r.item.type === 'answerable' ? 1 : 0;
    return { p: r.confidence, y: outcome };
  });
  const brier = points.reduce((a, { p, y }) => a + (p - y) ** 2, 0) / points.length;
  const buckets = Array.from({ length: bins }, (_, i) => ({ lo: i / bins, hi: (i + 1) / bins, count: 0, conf: 0, acc: 0 }));
  for (const { p, y } of points) {
    const b = buckets[Math.min(bins - 1, Math.floor(p * bins))];
    b.count += 1;
    b.conf += p;
    b.acc += y;
  }
  let ece = 0;
  const reliability = buckets.map((b) => {
    const avgConf = b.count ? b.conf / b.count : null;
    const accuracy = b.count ? b.acc / b.count : null;
    if (b.count) ece += (b.count / points.length) * Math.abs(avgConf - accuracy);
    return { range: `${b.lo.toFixed(1)}-${b.hi.toFixed(1)}`, count: b.count, avgConfidence: avgConf, accuracy };
  });
  return { ece, brier, reliability };
}

export function summarize(results) {
  const baseline = computeMetrics(results, 'baseline');
  const trust = computeMetrics(results, 'trust');
  const byCategory = {};
  for (const r of results) {
    const c = (byCategory[r.item.category] ||= { total: 0, baselineCorrect: 0, trustCorrect: 0 });
    c.total += 1;
    if (r.baseline.verdict === 'correct') c.baselineCorrect += 1;
    if (r.trust.verdict === 'correct') c.trustCorrect += 1;
  }
  const delta = (k) => trust[k] - baseline[k];
  return {
    baseline,
    trust,
    byCategory,
    improvements: {
      accuracy: delta('accuracy'),
      hallucinationRate: delta('hallucinationRate'),
      failedDecisionRate: delta('failedDecisionRate'),
      unnecessaryEscalationRate: delta('unnecessaryEscalationRate'),
    },
  };
}
