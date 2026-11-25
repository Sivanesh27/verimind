import { query } from '../db/pool.js';

const PUBLIC_COLUMNS = 'id, email, name, avatar_url, role, email_verified, created_at';

export async function findUserById(id) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

/** Includes password_hash — never send the result directly to a client. */
export async function findUserByEmailWithSecret(email) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

export async function createUser({ email, name, passwordHash = null, googleId = null, avatarUrl = null, role, emailVerified }) {
  const { rows } = await query(
    `INSERT INTO users (email, name, password_hash, google_id, avatar_url, role, email_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${PUBLIC_COLUMNS}`,
    [email, name, passwordHash, googleId, avatarUrl, role, emailVerified],
  );
  return rows[0];
}

export async function linkGoogleAccount(id, { googleId, avatarUrl }) {
  const { rows } = await query(
    `UPDATE users SET google_id = $2, avatar_url = COALESCE(avatar_url, $3), email_verified = TRUE
     WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, googleId, avatarUrl],
  );
  return rows[0];
}

export async function markEmailVerified(email) {
  const { rows } = await query(`UPDATE users SET email_verified = TRUE WHERE email = $1 RETURNING ${PUBLIC_COLUMNS}`, [email]);
  return rows[0];
}

/** Re-registration of an account that never verified its email. */
export async function updatePasswordUnverified(email, passwordHash, name) {
  await query('UPDATE users SET password_hash = $2, name = $3 WHERE email = $1 AND email_verified = FALSE', [email, passwordHash, name]);
}

export async function updatePassword(email, passwordHash) {
  await query('UPDATE users SET password_hash = $2, email_verified = TRUE WHERE email = $1', [email, passwordHash]);
}

/** Keep roles in sync with the ADMIN_EMAILS environment variable. */
export async function promoteAdmins(emails) {
  if (emails.length) await query(`UPDATE users SET role = 'admin' WHERE email = ANY($1) AND role <> 'admin'`, [emails]);
}

export async function setRole(id, role) {
  const { rows } = await query(`UPDATE users SET role = $2 WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`, [id, role]);
  return rows[0] || null;
}

export async function listUsers() {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY created_at DESC LIMIT 200`);
  return rows;
}

export async function listReviewerEmails() {
  const { rows } = await query(`SELECT email FROM users WHERE role IN ('reviewer', 'admin')`);
  return rows.map((r) => r.email);
}
