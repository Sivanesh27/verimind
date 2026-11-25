import { DATASET } from '../eval/dataset.js';
import { runEvaluation } from '../eval/runner.js';
import * as evals from '../repositories/evals.repo.js';
import { emit, rooms } from '../realtime/socket.js';
import { HttpError } from '../middleware/error.js';

let running = null;

export async function startEvaluation(user, { categories } = {}) {
  if (running) throw new HttpError(409, 'An evaluation is already running');
  const items = categories?.length ? DATASET.filter((d) => categories.includes(d.category)) : DATASET;
  if (!items.length) throw new HttpError(400, 'No scenarios match the selected categories');

  const evalRun = await evals.createEvalRun({ userId: user.id, total: items.length });
  running = evalRun.id;
  emit(rooms.monitor, 'eval:started', { id: evalRun.id, total: items.length });

  runEvaluation({
    items,
    onResult: async (result) => {
      await evals.appendEvalResult(evalRun.id, result);
      emit(rooms.monitor, 'eval:progress', { id: evalRun.id, result });
    },
  })
    .then(async ({ summary }) => {
      const done = await evals.finishEvalRun(evalRun.id, { status: 'completed', summary });
      emit(rooms.monitor, 'eval:completed', { id: evalRun.id, summary: done.summary });
    })
    .catch(async (err) => {
      console.error('[eval] failed', err);
      await evals.finishEvalRun(evalRun.id, { status: 'failed', error: err.message });
      emit(rooms.monitor, 'eval:failed', { id: evalRun.id, error: err.message });
    })
    .finally(() => {
      running = null;
    });

  return evalRun;
}

export const isEvaluationRunning = () => running;
