import { Router } from 'express';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import * as users from '../repositories/users.repo.js';
import * as codes from '../repositories/codes.repo.js';
import { signToken } from '../services/token.service.js';
import { sendEmail, codeEmail } from '../services/email.service.js';
import { verifyGoogleCredential } from '../services/google.service.js';

const router = Router();
// Brute-force protection for credential endpoints only (not /me, which runs on every page load).
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});
router.use((req, res, next) => (req.method === 'POST' ? credentialLimiter(req, res, next) : next()));

const email = z.string().trim().toLowerCase().email('Enter a valid email');
const password = z.string().min(8, 'Password must be at least 8 characters').max(128);
const code = z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits');

const hashCode = (c) => createHash('sha256').update(c).digest('hex');
const roleFor = (addr) => (env.adminEmails.includes(addr) ? 'admin' : 'user');
const session = (user) => ({ token: signToken(user), user: publicUser(user) });
const publicUser = ({ id, email: e, name, avatar_url, role, email_verified }) => ({ id, email: e, name, avatar_url, role, email_verified });

async function issueCode(addr, purpose) {
  const c = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await codes.replaceCode(addr, purpose, hashCode(c));
  await sendEmail({
    to: addr,
    subject: purpose === 'reset' ? 'Your VeriMind password reset code' : 'Verify your VeriMind email',
    html: codeEmail(c, purpose),
  });
}

async function consumeCode(addr, purpose, submitted) {
  const record = await codes.findActiveCode(addr, purpose);
  if (!record || record.attempts >= codes.MAX_ATTEMPTS) throw new HttpError(400, 'Code expired. Please request a new one.');
  const ok = timingSafeEqual(Buffer.from(record.code_hash), Buffer.from(hashCode(submitted)));
  if (!ok) {
    await codes.incrementAttempts(record.id);
    throw new HttpError(400, 'Incorrect code');
  }
  await codes.deleteCode(record.id);
}

router.post('/register', asyncHandler(async (req, res) => {
  const body = z.object({ name: z.string().trim().min(1).max(80), email, password }).parse(req.body);
  const existing = await users.findUserByEmailWithSecret(body.email);
  if (existing?.email_verified) throw new HttpError(409, 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(body.password, 12);
  if (existing) await users.updatePasswordUnverified(body.email, passwordHash, body.name);
  else await users.createUser({ email: body.email, name: body.name, passwordHash, role: roleFor(body.email), emailVerified: false });

  await issueCode(body.email, 'verify');
  res.status(201).json({ message: 'Verification code sent', email: body.email });
}));

router.post('/verify-email', asyncHandler(async (req, res) => {
  const body = z.object({ email, code }).parse(req.body);
  await consumeCode(body.email, 'verify', body.code);
  const user = await users.markEmailVerified(body.email);
  if (!user) throw new HttpError(404, 'Account not found');
  res.json(session(user));
}));

router.post('/resend-code', asyncHandler(async (req, res) => {
  const body = z.object({ email, purpose: z.enum(['verify', 'reset']).default('verify') }).parse(req.body);
  const user = await users.findUserByEmailWithSecret(body.email);
  if (user && (body.purpose === 'reset' || !user.email_verified)) await issueCode(body.email, body.purpose);
  res.json({ message: 'If the account exists, a new code was sent' });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const body = z.object({ email, password: z.string().min(1) }).parse(req.body);
  const user = await users.findUserByEmailWithSecret(body.email);
  const valid = user?.password_hash && (await bcrypt.compare(body.password, user.password_hash));
  if (!valid) throw new HttpError(401, user && !user.password_hash ? 'This account uses Google sign-in' : 'Invalid email or password');
  if (!user.email_verified) {
    await issueCode(user.email, 'verify');
    throw new HttpError(403, 'Please verify your email. We sent you a new code.', { code: 'EMAIL_NOT_VERIFIED', email: user.email });
  }
  res.json(session(user));
}));

router.post('/google', asyncHandler(async (req, res) => {
  const { credential } = z.object({ credential: z.string().min(10) }).parse(req.body);
  const profile = await verifyGoogleCredential(credential);
  const existing = await users.findUserByEmailWithSecret(profile.email);
  let user;
  if (!existing) {
    user = await users.createUser({ ...profile, role: roleFor(profile.email), emailVerified: true });
  } else if (!existing.google_id) {
    user = await users.linkGoogleAccount(existing.id, profile);
  } else {
    user = existing;
  }
  res.json(session(user));
}));

router.post('/forgot-password', asyncHandler(async (req, res) => {
  const body = z.object({ email }).parse(req.body);
  const user = await users.findUserByEmailWithSecret(body.email);
  if (user) await issueCode(body.email, 'reset');
  res.json({ message: 'If the account exists, a reset code was sent' });
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
  const body = z.object({ email, code, password }).parse(req.body);
  await consumeCode(body.email, 'reset', body.code);
  await users.updatePassword(body.email, await bcrypt.hash(body.password, 12));
  const user = await users.findUserByEmailWithSecret(body.email);
  res.json(session(user));
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
