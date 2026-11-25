import { query } from '../db/pool.js';

export async function createEvalRun({ userId, total }) {
  const { rows } = await query('INSERT INTO eval_runs (user_id, total) VALUES ($1, $2) RETURNING *', [userId, total]);
  return rows[0];
}

export async function appendEvalResult(id, result) {
  await query(
    `UPDATE eval_runs SET results = results || $2::jsonb, completed = completed + 1 WHERE id = $1`,
    [id, JSON.stringify([result])],
  );
}

export async function finishEvalRun(id, { status, summary = null, error = null }) {
  const { rows } = await query(
    `UPDATE eval_runs SET status = $2, summary = $3, error = $4, finished_at = NOW() WHERE id = $1 RETURNING *`,
    [id, status, summary && JSON.stringify(summary), error],
  );
  return rows[0];
}

export async function findEvalRun(id) {
  const { rows } = await query('SELECT * FROM eval_runs WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function listEvalRuns() {
  const { rows } = await query(
    'SELECT id, status, total, completed, summary, error, created_at, finished_at FROM eval_runs ORDER BY created_at DESC LIMIT 20',
  );
  return rows;
}

/** Any eval left "running" when the process died can never finish. */
export const failStaleEvalRuns = () =>
  query(`UPDATE eval_runs SET status = 'failed', error = 'Server restarted during evaluation', finished_at = NOW() WHERE status = 'running'`);
