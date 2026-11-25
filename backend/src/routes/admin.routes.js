import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as users from '../repositories/users.repo.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/users', asyncHandler(async (_req, res) => res.json({ users: await users.listUsers() })));

router.patch('/users/:id/role', asyncHandler(async (req, res) => {
  const { role } = z.object({ role: z.enum(['user', 'reviewer', 'admin']) }).parse(req.body);
  if (req.params.id === req.user.id) throw new HttpError(400, 'You cannot change your own role');
  const user = await users.setRole(req.params.id, role);
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ user });
}));

export default router;
