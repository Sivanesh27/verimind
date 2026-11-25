import { verifyToken } from '../services/token.service.js';
import { findUserById } from '../repositories/users.repo.js';
import { HttpError } from './error.js';

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Authentication required');
    const payload = verifyToken(token);
    const user = await findUserById(payload.sub);
    if (!user) throw new HttpError(401, 'User no longer exists');
    req.user = user;
    next();
  } catch (err) {
    next(err instanceof HttpError ? err : new HttpError(401, 'Invalid or expired session'));
  }
}

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(new HttpError(403, 'Insufficient permissions'));
