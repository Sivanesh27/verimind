import { query } from '../db/pool.js';

const TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;

export async function replaceCode(email, purpose, codeHash) {
  await query('DELETE FROM email_codes WHERE email = $1 AND purpose = $2', [email, purpose]);
  await query(
    `INSERT INTO email_codes (email, purpose, code_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '${TTL_MINUTES} minutes')`,
    [email, purpose, codeHash],
  );
}

export async function findActiveCode(email, purpose) {
  const { rows } = await query(
    `SELECT * FROM email_codes WHERE email = $1 AND purpose = $2 AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [email, purpose],
  );
  return rows[0] || null;
}

export const incrementAttempts = (id) => query('UPDATE email_codes SET attempts = attempts + 1 WHERE id = $1', [id]);
export const deleteCode = (id) => query('DELETE FROM email_codes WHERE id = $1', [id]);
