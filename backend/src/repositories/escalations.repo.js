import { query } from '../db/pool.js';

export async function createEscalation({ runId, reason }) {
  const { rows } = await query('INSERT INTO escalations (run_id, reason) VALUES ($1, $2) RETURNING *', [runId, reason]);
  return rows[0];
}

export async function listEscalations(status) {
  const { rows } = await query(
    `SELECT e.*, r.query, r.confidence, r.answer AS draft_answer, r.explanation, r.user_id,
            u.name AS user_name, u.email AS user_email, rv.name AS reviewer_name
     FROM escalations e
     JOIN agent_runs r ON r.id = e.run_id
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN users rv ON rv.id = e.reviewer_id
     WHERE ($1::text IS NULL OR e.status = $1)
     ORDER BY e.created_at DESC LIMIT 100`,
    [status || null],
  );
  return rows;
}

export async function resolveEscalation(id, { reviewerId, resolution, status }) {
  const { rows } = await query(
    `UPDATE escalations SET status = $2, resolution = $3, reviewer_id = $4, resolved_at = NOW()
     WHERE id = $1 AND status = 'open' RETURNING *`,
    [id, status, resolution, reviewerId],
  );
  return rows[0] || null;
}

export async function findEscalationByRun(runId) {
  const { rows } = await query('SELECT * FROM escalations WHERE run_id = $1', [runId]);
  return rows[0] || null;
}

export async function escalationCounts() {
  const { rows } = await query('SELECT status, COUNT(*)::int AS count FROM escalations GROUP BY status');
  return Object.fromEntries(rows.map((r) => [r.status, r.count]));
}
