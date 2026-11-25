/**
 * Application service around the agents: persistence, realtime streaming,
 * escalation hand-off and audit trail.
 */
import { env } from '../config/env.js';
import { runTrustAgent } from '../agent/trustAgent.js';
import { runBaselineAgent } from '../agent/baselineAgent.js';
import * as runs from '../repositories/runs.repo.js';
import * as escalations from '../repositories/escalations.repo.js';
import { listReviewerEmails } from '../repositories/users.repo.js';
import { emit, rooms } from '../realtime/socket.js';
import { sendEmailSafe, escalationEmail } from './email.service.js';
import { HttpError } from '../middleware/error.js';

const MAX_CONCURRENT_PER_USER = 2;
const active = new Map(); // userId -> number of running agent jobs

const ESCALATION_MESSAGE =
  "I'm not confident enough to answer this reliably, so I've escalated it to a human reviewer. You'll be notified here when they respond.";

export async function startRun(user, { query, mode, parentRunId }) {
  const running = active.get(user.id) || 0;
  if (running >= MAX_CONCURRENT_PER_USER) throw new HttpError(429, 'Please wait for your current questions to finish');

  let context = null;
  if (parentRunId) {
    const parent = await runs.findRun(parentRunId);
    if (!parent || parent.user_id !== user.id) throw new HttpError(404, 'Parent conversation not found');
    if (parent.route !== 'clarify') throw new HttpError(400, 'That run did not ask for clarification');
    context = { previousQuery: parent.query, clarifyingQuestion: parent.answer };
  }

  const run = await runs.createRun({ userId: user.id, query, mode, parentId: parentRunId });
  active.set(user.id, running + 1);
  emit(rooms.monitor, 'monitor:run-started', { id: run.id, query, mode, userName: user.name, createdAt: run.created_at });

  // Run in the background; the client follows progress over the socket.
  execute(user, run, mode, context)
    .catch((err) => console.error('[agent] run failed', run.id, err))
    .finally(() => active.set(user.id, Math.max(0, (active.get(user.id) || 1) - 1)));

  return run;
}

async function execute(user, run, mode, context) {
  const room = rooms.user(user.id);
  const onStep = (step) => emit(room, 'run:step', { runId: run.id, step });

  let result;
  try {
    if (mode === 'baseline') {
      onStep({ key: 'baseline', label: 'Answering directly (baseline agent)', status: 'running' });
      result = await runBaselineAgent(run.query);
      onStep({ key: 'baseline', label: 'Answering directly (baseline agent)', status: 'done', durationMs: result.latencyMs });
    } else {
      result = await runTrustAgent(run.query, { onStep, context });
    }
  } catch (err) {
    const failed = await runs.completeRun(run.id, { status: 'failed', error: err.message });
    emit(room, 'run:complete', serializeRun(failed));
    emit(rooms.monitor, 'monitor:run-completed', summarize(failed, user));
    return;
  }

  const isEscalation = result.route === 'escalate';
  const saved = await runs.completeRun(run.id, {
    status: isEscalation ? 'awaiting_review' : 'completed',
    route: result.route,
    confidence: result.confidence,
    level: result.level,
    // For escalations keep the unverified draft for the reviewer, but show the user the hand-off message.
    answer: isEscalation ? result.draftAnswer : result.answer,
    explanation: result.explanation,
    signals: { ...(result.signals || {}), path: result.path },
    steps: result.steps || [],
    sources: result.sources,
    latencyMs: result.latencyMs,
  });

  if (isEscalation) await openEscalation(saved, result);

  emit(room, 'run:complete', serializeRun(saved));
  emit(rooms.monitor, 'monitor:run-completed', summarize(saved, user));
}

async function openEscalation(run, result) {
  const concerns = result.explanation.filter((f) => f.severity !== 'positive');
  const reason = concerns.map((f) => f.label).join(', ') || 'Low confidence';
  const esc = await escalations.createEscalation({ runId: run.id, reason });
  emit(rooms.reviewers, 'escalation:new', { ...esc, query: run.query, confidence: run.confidence });

  const reviewers = await listReviewerEmails();
  for (const to of reviewers) {
    sendEmailSafe({
      to,
      subject: `[VeriMind] Escalation: ${run.query.slice(0, 60)}`,
      html: escalationEmail({
        query: run.query,
        confidence: run.confidence,
        reasons: concerns.map((f) => `${f.label}: ${f.detail}`),
        link: `${env.frontendUrl}/review`,
      }),
    });
  }
}

/** What the asking user sees. Escalated drafts stay hidden until a human reviews them. */
export function serializeRun(run) {
  if (run.route !== 'escalate') return run;
  if (run.escalation_status === 'resolved') {
    return { ...run, answer: run.escalation_resolution, answered_by: 'human' };
  }
  if (run.escalation_status === 'dismissed') {
    return { ...run, answer: 'A reviewer closed this escalation without an answer. Please rephrase or add detail.' };
  }
  return { ...run, answer: ESCALATION_MESSAGE };
}

function summarize(run, user) {
  return {
    id: run.id,
    query: run.query,
    mode: run.mode,
    route: run.route,
    confidence: run.confidence,
    level: run.level,
    status: run.status,
    latency_ms: run.latency_ms,
    user_name: user.name,
    created_at: run.created_at,
  };
}
