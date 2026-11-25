import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import * as runs from '../repositories/runs.repo.js';
import { escalationCounts } from '../repositories/escalations.repo.js';
import { env } from '../config/env.js';

const router = Router();
router.use(requireAuth);

router.get('/stats', asyncHandler(async (req, res) => {
  const days = z.coerce.number().int().min(1).max(365).default(30).parse(req.query.days);
  const isStaff = ['reviewer', 'admin'].includes(req.user.role);
  const scope = req.query.scope === 'all' && isStaff ? null : req.user.id;
  const [stats, escalations] = await Promise.all([runs.runStats({ userId: scope, days }), escalationCounts()]);
  res.json({ stats, escalations: isStaff ? escalations : undefined, thresholds: env.thresholds, scope: scope ? 'mine' : 'all' });
}));

router.get('/recent', asyncHandler(async (req, res) => {
  const isStaff = ['reviewer', 'admin'].includes(req.user.role);
  const list = isStaff ? await runs.recentRuns(30) : (await runs.listRunsForUser(req.user.id, 30));
  res.json({ runs: list.map(({ id, query, route, confidence, level, latency_ms, status, created_at, user_name }) => ({ id, query, route, confidence, level, latency_ms, status, created_at, user_name })) });
}));

export default router;
