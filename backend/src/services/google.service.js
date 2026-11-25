import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/error.js';

const client = new OAuth2Client();

/** Verify a Google Identity Services ID token ("credential") and return the profile. */
export async function verifyGoogleCredential(credential) {
  if (!env.googleClientId) throw new HttpError(501, 'Google sign-in is not configured on the server');
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: env.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(401, 'Invalid Google credential');
  }
  if (!payload?.email || !payload.email_verified) throw new HttpError(401, 'Google account email is not verified');
  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email,
    avatarUrl: payload.picture || null,
  };
}
