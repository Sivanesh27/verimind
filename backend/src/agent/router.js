/**
 * Decision Router: maps a confidence level plus context to the next action.
 *
 *   high                         -> answer      (deliver directly)
 *   medium, not yet verified     -> verify      (retrieve + tool check, re-answer, re-score)
 *   medium, already verified     -> answer      (deliver, with verification attached)
 *   low, ambiguous query         -> clarify     (ask the user one question)
 *   low, not yet verified        -> verify      (one grounded retry before giving up)
 *   low, specialist domain       -> specialist  (hand over once to a domain specialist agent)
 *   low, otherwise               -> escalate    (human review queue)
 */
export const ROUTES = ['answer', 'verify', 'clarify', 'specialist', 'escalate'];

export function decideRoute({ level, analysis, verified = false, specialistTried = false }) {
  if (level === 'high') return 'answer';
  if (level === 'medium') return verified ? 'answer' : 'verify';

  const ambiguous = (analysis?.ambiguity ?? 0) >= 0.5 && analysis?.clarifying_question;
  if (ambiguous) return 'clarify';
  if (!verified) return 'verify';
  const specialistDomain = analysis && (analysis.high_stakes || analysis.domain !== 'general');
  if (specialistDomain && !specialistTried) return 'specialist';
  return 'escalate';
}
