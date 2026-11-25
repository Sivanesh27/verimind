import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import * as runs from '../repositories/runs.repo.js';
import { startRun, serializeRun } from '../services/agent.service.js';

const router = Router();
router.use(requireAuth);

const askLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  keyGenerator: (req) => req.user.id,
  message: { error: 'Hourly question limit reached. Please try again later.' },
});

router.post('/ask', askLimiter, asyncHandler(async (req, res) => {
  const body = z
    .object({
      query: z.string().trim().min(2, 'Ask a question').max(2000),
      mode: z.enum(['trust', 'baseline']).default('trust'),
      parentRunId: z.string().uuid().optional(),
    })
    .parse(req.body);
  const run = await startRun(req.user, body);
  res.status(202).json({ run });
}));

router.get('/runs', asyncHandler(async (req, res) => {
  const list = await runs.listRunsForUser(req.user.id);
  res.json({ runs: list.map(serializeRun) });
}));

router.get('/runs/:id', asyncHandler(async (req, res) => {
  const run = await runs.findRun(req.params.id);
  const isStaff = ['reviewer', 'admin'].includes(req.user.role);
  if (!run || (run.user_id !== req.user.id && !isStaff)) throw new HttpError(404, 'Run not found');
  res.json({ run: run.user_id === req.user.id ? serializeRun(run) : run });
}));

export default router;
