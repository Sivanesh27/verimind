import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as escalations from '../repositories/escalations.repo.js';
import * as runs from '../repositories/runs.repo.js';
import { findUserById } from '../repositories/users.repo.js';
import { emit, rooms } from '../realtime/socket.js';
import { serializeRun } from '../services/agent.service.js';
import { sendEmailSafe, resolutionEmail } from '../services/email.service.js';

const router = Router();
router.use(requireAuth, requireRole('reviewer', 'admin'));

router.get('/', asyncHandler(async (req, res) => {
  const status = z.enum(['open', 'resolved', 'dismissed']).optional().parse(req.query.status || undefined);
  res.json({ escalations: await escalations.listEscalations(status) });
}));

router.post('/:id/resolve', asyncHandler(async (req, res) => {
  const body = z
    .object({
      action: z.enum(['resolve', 'dismiss']),
      resolution: z.string().trim().max(5000).default(''),
    })
    .refine((b) => b.action === 'dismiss' || b.resolution.length > 0, { message: 'Write an answer for the user' })
    .parse(req.body);

  const esc = await escalations.resolveEscalation(req.params.id, {
    reviewerId: req.user.id,
    resolution: body.resolution || null,
    status: body.action === 'resolve' ? 'resolved' : 'dismissed',
  });
  if (!esc) throw new HttpError(409, 'Escalation not found or already handled');

  await runs.markReviewed(esc.run_id);
  const run = await runs.findRun(esc.run_id);
  emit(rooms.user(run.user_id), 'run:reviewed', serializeRun(run));
  emit(rooms.reviewers, 'escalation:updated', esc);

  const owner = run.user_id && (await findUserById(run.user_id));
  if (owner && esc.status === 'resolved') {
    sendEmailSafe({
      to: owner.email,
      subject: 'A reviewer answered your VeriMind question',
      html: resolutionEmail({ query: run.query, resolution: esc.resolution, link: `${env.frontendUrl}/history` }),
    });
  }
  res.json({ escalation: esc });
}));

export default router;
