/**
 * Trust-Aware Agent.
 *
 * Pipeline:  analyze -> draft + parallel samples + retrieval + tool  -> judge -> score -> route
 *            -> (verify | specialist)* -> final decision (answer | clarify | escalate)
 *
 * Every stage is reported through `onStep` so the UI can render the reasoning live.
 */
import { structured, LlmRefusalError, isLocal } from './llm.js';
import { env } from '../config/env.js';
import * as P from './prompts.js';
import * as S from './schemas.js';
import { searchWikipedia } from './tools/wikipedia.js';
import { calculate, numbersMatch } from './tools/calculator.js';
import { scoreConfidence, explainConfidence, clamp01 } from './confidence.js';
import { decideRoute } from './router.js';

// Extra independent attempts for self-consistency. A CPU-bound local model defaults to 1 (LLM_SAMPLES) to keep latency sane.
const SAMPLE_COUNT = isLocal ? Math.max(1, env.local.samples) : 2;
const MAX_LOOPS = 3;

export async function runTrustAgent(query, { onStep = () => {}, context = null } = {}) {
  const started = Date.now();
  const steps = [];
  const trace = createTracer(steps, onStep);
  const fullQuery = context
    ? `Original question: ${context.previousQuery}\nThe assistant asked: ${context.clarifyingQuestion}\nUser's clarification: ${query}`
    : query;

  try {
    // 1. Understand the query --------------------------------------------------------------
    const analysis = await trace('analyze', 'Analyzing query', async () => {
      const a = await structured({ system: P.ANALYZER_SYSTEM, prompt: fullQuery, schema: S.QueryAnalysis, effort: 'low' });
      a.ambiguity = clamp01(a.ambiguity);
      return { result: a, detail: `domain=${a.domain}, ambiguity=${pct(a.ambiguity)}${a.high_stakes ? ', high-stakes' : ''}` };
    });

    // Short-circuit: hopelessly ambiguous questions should not burn an answer attempt.
    if (analysis.ambiguity >= 0.75 && analysis.clarifying_question && !context) {
      const signals = blankSignals({ clarity: 1 - analysis.ambiguity });
      const scored = scoreConfidence(signals, { highStakes: analysis.high_stakes });
      trace.event('route', 'Routing decision', `Confidence ${pct(scored.score)} (low) -> clarify`);
      return finish({ route: 'clarify', answer: analysis.clarifying_question, scored, signals, analysis, path: ['clarify'] });
    }

    // 2. Draft answer + independent samples + retrieval + tool, in parallel -------------------
    const [draft, samples, sources, tool] = await Promise.all([
      trace('draft', 'Drafting answer', async () => {
        const d = await answer(P.ANSWER_SYSTEM, fullQuery);
        return { result: d, detail: `self-reported confidence ${pct(d.confidence)}` };
      }),
      trace('samples', `Sampling ${SAMPLE_COUNT} independent reasoning paths`, async () => {
        const s = await Promise.all(
          Array.from({ length: SAMPLE_COUNT }, (_, i) =>
            structured({
              system: `${P.ANSWER_SYSTEM}\nReason independently (attempt ${i + 2}).`,
              prompt: fullQuery,
              schema: S.SampleAnswer,
              effort: 'low',
              temperature: 0.9, // diversity between samples (used by the local provider)
            }).then((r) => r.answer),
          ),
        );
        return { result: s, detail: `${s.length} alternative answers` };
      }),
      trace('retrieve', 'Retrieving evidence', async () => {
        const qs = (analysis.search_queries || []).slice(0, 2);
        const found = (await Promise.all(qs.map((q) => searchWikipedia(q)))).flat();
        const unique = dedupe(found).slice(0, 4);
        return { result: unique, detail: unique.length ? unique.map((s) => s.title).join(', ') : 'no sources found' };
      }),
      analysis.needs_calculation && analysis.math_expression
        ? trace('tool', 'Running calculator', async () => {
            const t = { name: 'calculator', expression: analysis.math_expression, ...calculate(analysis.math_expression) };
            return { result: t, detail: t.ok ? `${t.expression} = ${t.value}` : `failed: ${t.error}` };
          })
        : Promise.resolve(null),
    ]);

    // 3. Judge consistency and evidence ----------------------------------------------------
    const [consistency, evidence] = await Promise.all([
      judgeConsistency(trace, fullQuery, [draft.answer, ...samples]),
      judgeEvidence(trace, fullQuery, draft.answer, sources),
    ]);

    let state = { draft, sources, tool, consistency, evidence, verified: false, specialistTried: false };
    let scored = score(state, analysis);
    const path = [];

    // 4. Route, possibly looping through verify / specialist ---------------------------------
    for (let i = 0; i < MAX_LOOPS; i++) {
      const route = decideRoute({ level: scored.level, analysis, verified: state.verified, specialistTried: state.specialistTried });
      trace.event('route', 'Routing decision', `Confidence ${pct(scored.score)} (${scored.level}) -> ${route}`);
      path.push(route);

      if (route === 'verify') {
        state = await verify(trace, fullQuery, analysis, state);
        scored = score(state, analysis);
        continue;
      }
      if (route === 'specialist') {
        state = await consultSpecialist(trace, fullQuery, analysis, state);
        scored = score(state, analysis);
        continue;
      }
      return finish({
        route: route === 'answer' && state.specialistTried ? 'specialist' : route,
        answer: route === 'clarify' ? analysis.clarifying_question : state.draft.answer,
        draftAnswer: state.draft.answer,
        scored,
        signals: scored.signals,
        analysis,
        state,
        path,
      });
    }
    trace.event('route', 'Routing decision', 'Loop budget exhausted -> escalate');
    return finish({ route: 'escalate', answer: state.draft.answer, draftAnswer: state.draft.answer, scored, signals: scored.signals, analysis, state, path: [...path, 'escalate'] });
  } catch (err) {
    if (err instanceof LlmRefusalError) {
      trace.event('route', 'Routing decision', 'Model declined -> escalate');
      const scored = { score: 0, level: 'low', contributions: [], caps: [{ limit: 0, reason: err.message }] };
      return finish({ route: 'escalate', answer: null, scored, signals: blankSignals(), analysis: null, path: ['escalate'], extraFactors: [{ code: 'MODEL_DECLINED', label: 'Model declined', severity: 'high', detail: err.message }] });
    }
    throw err;
  }

  function finish({ route, answer: finalAnswer, draftAnswer = null, scored, signals, analysis, state = {}, path, extraFactors = [] }) {
    const explanation = [
      ...extraFactors,
      ...explainConfidence({
        signals,
        analysis,
        draft: state.draft,
        evidenceJudgement: state.evidence,
        consistencyJudgement: state.consistency,
        tool: state.tool,
        sources: state.sources,
      }),
    ];
    return {
      route,
      path,
      confidence: scored.score,
      level: scored.level,
      answer: finalAnswer,
      draftAnswer,
      explanation,
      signals: { values: signals, contributions: scored.contributions, caps: scored.caps, analysis },
      sources: state.sources || [],
      steps,
      latencyMs: Date.now() - started,
    };
  }
}

// --- stages ------------------------------------------------------------------------------

async function answer(system, prompt) {
  const d = await structured({ system, prompt, schema: S.DraftAnswer, effort: 'medium' });
  d.confidence = clamp01(d.confidence);
  return d;
}

async function judgeConsistency(trace, question, answers) {
  return trace('consistency', 'Checking self-consistency', async () => {
    const list = answers.map((a, i) => `Answer ${i + 1}:\n${a}`).join('\n\n');
    const j = await structured({
      system: P.CONSISTENCY_SYSTEM,
      prompt: `Question: ${question}\n\n${list}`,
      schema: S.ConsistencyJudgement,
      effort: 'low',
    });
    j.agreement = clamp01(j.agreement);
    return { result: j, detail: `agreement ${pct(j.agreement)}` };
  });
}

async function judgeEvidence(trace, question, proposed, sources) {
  if (!sources.length) return null;
  return trace('evidence', 'Judging evidence', async () => {
    const ev = sources.map((s, i) => `[${i + 1}] ${s.title} (${s.source})\n${s.snippet}`).join('\n\n');
    const j = await structured({
      system: P.EVIDENCE_SYSTEM,
      prompt: `Question: ${question}\n\nProposed answer: ${proposed}\n\nEvidence:\n${ev}`,
      schema: S.EvidenceJudgement,
      effort: 'low',
    });
    j.support = clamp01(j.support);
    return { result: j, detail: `${j.evidence_relevant ? `support ${pct(j.support)}` : 'evidence not relevant'}${j.contradiction ? ', CONTRADICTION' : ''}` };
  });
}

/** Medium/low confidence: gather more evidence and re-answer grounded in it. */
async function verify(trace, question, analysis, state) {
  const extraQueries = (state.draft.key_claims || []).slice(0, 2);
  const more = await trace('verify-retrieve', 'Searching for more evidence', async () => {
    const found = (await Promise.all(extraQueries.map((q) => searchWikipedia(q, 1)))).flat();
    return { result: found, detail: found.length ? found.map((s) => s.title).join(', ') : 'nothing new' };
  });
  const sources = dedupe([...state.sources, ...more]).slice(0, 6);
  const draft = await trace('verify-answer', 'Re-answering with evidence', async () => {
    const d = await answer(P.GROUNDED_SYSTEM, groundedPrompt(question, sources, state.tool));
    return { result: d, detail: `self-reported confidence ${pct(d.confidence)}` };
  });
  const [consistency, evidence] = await Promise.all([
    judgeConsistency(trace, question, [draft.answer, state.draft.answer]),
    judgeEvidence(trace, question, draft.answer, sources),
  ]);
  // Agreement between the grounded and ungrounded answer, blended with the original sampling agreement.
  consistency.agreement = clamp01((consistency.agreement + state.consistency.agreement) / 2);
  return { ...state, draft, sources, consistency, evidence, verified: true };
}

/** Low confidence in a specialist domain: hand over to a domain specialist agent once. */
async function consultSpecialist(trace, question, analysis, state) {
  const domain = analysis.domain in P.SPECIALIST_SYSTEMS ? analysis.domain : 'general';
  const draft = await trace('specialist', `Consulting ${domain} specialist agent`, async () => {
    const d = await answer(`${P.SPECIALIST_SYSTEMS[domain]}\n\n${P.GROUNDED_SYSTEM}`, groundedPrompt(question, state.sources, state.tool));
    return { result: d, detail: `specialist confidence ${pct(d.confidence)}` };
  });
  const [consistency, evidence] = await Promise.all([
    judgeConsistency(trace, question, [draft.answer, state.draft.answer]),
    judgeEvidence(trace, question, draft.answer, state.sources),
  ]);
  return { ...state, draft, consistency, evidence, specialistTried: true };
}

// --- scoring -----------------------------------------------------------------------------

function score(state, analysis) {
  const signals = buildSignals(state, analysis);
  const scored = scoreConfidence(signals, { contradiction: !!state.evidence?.contradiction, highStakes: analysis.high_stakes });
  return { ...scored, signals };
}

export function buildSignals({ draft, consistency, evidence, sources, tool }, analysis) {
  const relevant = evidence?.evidence_relevant;
  let evidenceSignal = null;
  if (evidence && relevant) evidenceSignal = evidence.contradiction ? Math.min(evidence.support, 0.2) : evidence.support;
  else if (!tool?.ok) evidenceSignal = 0.4; // nothing to check against: weak, not neutral

  let toolSignal = null;
  if (tool?.ok) toolSignal = numbersMatch(tool.value, draft.numeric_answer) ? 1 : 0;

  return {
    selfAssessment: draft.confidence,
    consistency: consistency?.agreement ?? null,
    evidence: evidenceSignal,
    sourceReliability: relevant && sources.length ? avg(sources.map((s) => s.reliability)) : tool?.ok ? 1 : null,
    toolVerification: toolSignal,
    clarity: 1 - analysis.ambiguity,
  };
}

// --- helpers -----------------------------------------------------------------------------

function createTracer(steps, onStep) {
  async function trace(key, label, fn) {
    const step = { key, label, status: 'running', startedAt: new Date().toISOString() };
    steps.push(step);
    onStep({ ...step });
    const t0 = Date.now();
    try {
      const { result, detail } = await fn();
      Object.assign(step, { status: 'done', detail, durationMs: Date.now() - t0 });
      onStep({ ...step });
      return result;
    } catch (err) {
      Object.assign(step, { status: 'failed', detail: err.message, durationMs: Date.now() - t0 });
      onStep({ ...step });
      throw err;
    }
  }
  trace.event = (key, label, detail) => {
    const step = { key, label, status: 'done', detail, startedAt: new Date().toISOString(), durationMs: 0 };
    steps.push(step);
    onStep({ ...step });
  };
  return trace;
}

function groundedPrompt(question, sources, tool) {
  const ev = sources.length ? sources.map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet}`).join('\n\n') : 'No evidence found.';
  const toolText = tool ? `\n\nTool result: ${tool.ok ? `${tool.expression} = ${tool.value}` : `calculator failed (${tool.error})`}` : '';
  return `Question: ${question}\n\nRetrieved evidence:\n${ev}${toolText}`;
}

function blankSignals(overrides = {}) {
  return { selfAssessment: null, consistency: null, evidence: null, sourceReliability: null, toolVerification: null, clarity: null, ...overrides };
}

const dedupe = (sources) => [...new Map(sources.map((s) => [s.url, s])).values()];
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (n) => `${Math.round(n * 100)}%`;
