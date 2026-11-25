import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as evals from '../repositories/evals.repo.js';
import { DATASET, DATASET_CATEGORIES } from '../eval/dataset.js';
import { startEvaluation, isEvaluationRunning } from '../services/eval.service.js';

const router = Router();
router.use(requireAuth);

router.get('/dataset', (_req, res) => res.json({ dataset: DATASET, categories: DATASET_CATEGORIES }));

router.get('/runs', asyncHandler(async (_req, res) => {
  res.json({ runs: await evals.listEvalRuns(), running: isEvaluationRunning() });
}));

router.get('/runs/:id', asyncHandler(async (req, res) => {
  const run = await evals.findEvalRun(req.params.id);
  if (!run) throw new HttpError(404, 'Evaluation not found');
  res.json({ run });
}));

// Evaluations call the LLM ~10x per scenario, so only admins may start them.
router.post('/runs', requireRole('admin'), asyncHandler(async (req, res) => {
  const body = z.object({ categories: z.array(z.enum(DATASET_CATEGORIES)).optional() }).parse(req.body || {});
  const run = await startEvaluation(req.user, body);
  res.status(202).json({ run });
}));

export default router;
