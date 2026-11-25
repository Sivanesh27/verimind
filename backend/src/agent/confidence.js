/**
 * Confidence Estimation Layer.
 * Pure functions: combine independent uncertainty signals into one calibrated score
 * and translate them into human-readable explanation factors.
 */
import { env } from '../config/env.js';

/** Relative importance of each signal. Signals that are unavailable (null) are dropped and the rest re-normalised. */
export const WEIGHTS = {
  selfAssessment: 0.15, // model's verbalised probability of being right
  consistency: 0.25, // agreement across independent reasoning attempts
  evidence: 0.25, // how well retrieved evidence supports the answer
  sourceReliability: 0.1, // trustworthiness of the sources used
  toolVerification: 0.3, // deterministic tool check (e.g. calculator)
  clarity: 0.15, // 1 - ambiguity of the query
};

export const SIGNAL_LABELS = {
  selfAssessment: 'Model self-assessment',
  consistency: 'Self-consistency',
  evidence: 'Evidence support',
  sourceReliability: 'Source reliability',
  toolVerification: 'Tool verification',
  clarity: 'Query clarity',
};

/**
 * Clamp to [0,1]. Small local models often report probabilities as percentages (e.g. 85 instead of 0.85),
 * so values in (1, 100] are treated as percentages.
 */
export const clamp01 = (n) => {
  if (!Number.isFinite(n)) return 0;
  const v = n > 1 && n <= 100 ? n / 100 : n;
  return Math.min(1, Math.max(0, v));
};

export function levelFor(score, { highStakes = false } = {}) {
  const high = highStakes ? Math.min(0.95, env.thresholds.high + 0.1) : env.thresholds.high;
  if (score >= high) return 'high';
  if (score >= env.thresholds.medium) return 'medium';
  return 'low';
}

/**
 * @param {Record<string, number|null>} signals values in [0,1] or null when not applicable
 * @param {{contradiction?: boolean, highStakes?: boolean}} flags
 */
export function scoreConfidence(signals, flags = {}) {
  const contributions = [];
  let weighted = 0;
  let totalWeight = 0;
  for (const [name, weight] of Object.entries(WEIGHTS)) {
    const value = signals[name];
    if (value === null || value === undefined) continue;
    const v = clamp01(value);
    weighted += v * weight;
    totalWeight += weight;
    contributions.push({ signal: name, label: SIGNAL_LABELS[name], value: round(v), weight });
  }
  let score = totalWeight ? weighted / totalWeight : 0;

  // Hard caps: a single decisive red flag must not be averaged away by other healthy signals.
  const caps = [];
  const cap = (limit, reason) => {
    if (score > limit) {
      score = limit;
      caps.push({ limit, reason });
    }
  };
  if (signals.toolVerification === 0) cap(0.3, 'Tool verification contradicted the answer');
  if (flags.contradiction) cap(0.4, 'Evidence contradicts a key claim');
  if (signals.clarity !== null && signals.clarity !== undefined && signals.clarity < 0.4) cap(0.45, 'Query is too ambiguous to answer reliably');
  if (signals.consistency !== null && signals.consistency !== undefined && signals.consistency < 0.35) cap(0.5, 'Independent reasoning attempts disagree');

  score = round(score);
  for (const c of contributions) c.share = totalWeight ? round((c.value * c.weight) / totalWeight) : 0;
  return { score, level: levelFor(score, flags), contributions, caps };
}

/**
 * Turn raw signals into the explanation shown to the user ("why was the agent unsure?").
 * severity: high | medium | low (concerns) or positive (reasons for trust).
 */
export function explainConfidence({ signals, analysis, draft, evidenceJudgement, consistencyJudgement, tool, sources }) {
  const f = [];
  const add = (code, label, severity, detail) => f.push({ code, label, severity, detail });

  if (signals.clarity !== null && signals.clarity < 0.7) {
    add('AMBIGUOUS_QUERY', 'Ambiguous query', signals.clarity < 0.4 ? 'high' : 'medium', analysis?.ambiguity_reason || 'The question can be read in more than one way.');
  }
  if (draft?.missing_information?.length) {
    add('MISSING_INFORMATION', 'Missing information', draft.missing_information.length > 1 ? 'medium' : 'low', draft.missing_information.join('; '));
  }
  if (evidenceJudgement?.contradiction) {
    add('CONFLICTING_EVIDENCE', 'Conflicting evidence', 'high', evidenceJudgement.notes);
  } else if (evidenceJudgement && !evidenceJudgement.evidence_relevant) {
    add('NO_SUPPORTING_EVIDENCE', 'No supporting source found', 'medium', 'Retrieved sources did not address the question, so the answer rests on the model\'s memory alone.');
  } else if (signals.evidence !== null && signals.evidence >= 0.75) {
    add('SUPPORTED_BY_EVIDENCE', 'Supported by evidence', 'positive', evidenceJudgement?.notes || 'Retrieved sources support the answer.');
  } else if (signals.evidence !== null && signals.evidence < 0.5) {
    add('WEAK_EVIDENCE', 'Weak evidence', 'medium', evidenceJudgement?.notes || 'Evidence only partially supports the answer.');
  }
  if (signals.sourceReliability !== null && signals.sourceReliability < 0.6) {
    add('LOW_SOURCE_RELIABILITY', 'Low source reliability', 'medium', 'The available sources are not authoritative.');
  }
  if (tool) {
    if (tool.ok && signals.toolVerification === 1) add('VERIFIED_BY_TOOL', 'Verified by tool', 'positive', `Calculator computed ${tool.value}, matching the answer.`);
    else if (tool.ok && signals.toolVerification === 0) add('FAILED_VERIFICATION', 'Failed verification', 'high', `Calculator computed ${tool.value}, which does not match the answer.`);
    else if (!tool.ok) add('FAILED_VERIFICATION', 'Verification unavailable', 'low', `Tool could not run: ${tool.error}`);
  }
  if (signals.consistency !== null && signals.consistency < 0.6) {
    add('INCONSISTENT_REASONING', 'Inconsistent reasoning', signals.consistency < 0.35 ? 'high' : 'medium', consistencyJudgement?.divergent_points?.join('; ') || 'Independent attempts reached different conclusions.');
  } else if (signals.consistency !== null && signals.consistency >= 0.85) {
    add('CONSISTENT_REASONING', 'Consistent reasoning', 'positive', 'Independent reasoning attempts agree.');
  }
  if (signals.selfAssessment !== null && signals.selfAssessment < 0.5) {
    add('LOW_SELF_ASSESSMENT', 'Model unsure', 'medium', 'The model itself reported low certainty in this answer.');
  }
  if (analysis?.requires_current_info) {
    add('TIME_SENSITIVE', 'Time-sensitive question', 'medium', 'The answer may depend on events after the model\'s knowledge cutoff.');
  }
  if (analysis?.high_stakes) {
    add('HIGH_STAKES', `High-stakes (${analysis.domain})`, 'medium', 'A stricter confidence threshold is applied because a wrong answer could cause harm.');
  }
  if (!sources?.length && !tool) {
    add('NO_SOURCES', 'No sources consulted', 'low', 'No external source or tool could be used to check this answer.');
  }
  const order = { high: 0, medium: 1, low: 2, positive: 3 };
  return f.sort((a, b) => order[a.severity] - order[b.severity]);
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}
