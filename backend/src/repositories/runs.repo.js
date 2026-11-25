import { query } from '../db/pool.js';

export async function createRun({ userId, query: q, mode, parentId = null }) {
  const { rows } = await query(
    'INSERT INTO agent_runs (user_id, query, mode, parent_id) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, q, mode, parentId],
  );
  return rows[0];
}

export async function completeRun(id, r) {
  const { rows } = await query(
    `UPDATE agent_runs SET status = $2, route = $3, confidence = $4, level = $5, answer = $6,
       explanation = $7, signals = $8, steps = $9, sources = $10, latency_ms = $11, error = $12
     WHERE id = $1 RETURNING *`,
    [
      id,
      r.status,
      r.route ?? null,
      r.confidence ?? null,
      r.level ?? null,
      r.answer ?? null,
      JSON.stringify(r.explanation ?? []),
      JSON.stringify(r.signals ?? {}),
      JSON.stringify(r.steps ?? []),
      JSON.stringify(r.sources ?? []),
      r.latencyMs ?? null,
      r.error ?? null,
    ],
  );
  return rows[0];
}

const WITH_ESCALATION = `SELECT r.*, e.status AS escalation_status, e.resolution AS escalation_resolution
  FROM agent_runs r LEFT JOIN escalations e ON e.run_id = r.id`;

export async function findRun(id) {
  const { rows } = await query(`${WITH_ESCALATION} WHERE r.id = $1`, [id]);
  return rows[0] || null;
}

export async function listRunsForUser(userId, limit = 50) {
  const { rows } = await query(`${WITH_ESCALATION} WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT $2`, [userId, limit]);
  return rows;
}

export async function markReviewed(id) {
  await query(`UPDATE agent_runs SET status = 'reviewed' WHERE id = $1`, [id]);
}

export async function runStats({ userId = null, days = 30 } = {}) {
  const scope = userId ? 'AND user_id = $2' : '';
  const params = userId ? [days, userId] : [days];
  const [totals, routes, daily, levels] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(AVG(confidence), 0)::float AS avg_confidence,
              COALESCE(AVG(latency_ms), 0)::float AS avg_latency_ms,
              COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
       FROM agent_runs WHERE created_at > NOW() - ($1 || ' days')::interval AND mode = 'trust' ${scope}`,
      params,
    ),
    query(
      `SELECT route, COUNT(*)::int AS count FROM agent_runs
       WHERE created_at > NOW() - ($1 || ' days')::interval AND mode = 'trust' AND route IS NOT NULL ${scope}
       GROUP BY route`,
      params,
    ),
    query(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS runs,
              COALESCE(AVG(confidence), 0)::float AS avg_confidence
       FROM agent_runs WHERE created_at > NOW() - ($1 || ' days')::interval AND mode = 'trust' ${scope}
       GROUP BY 1 ORDER BY 1`,
      params,
    ),
    query(
      `SELECT width_bucket(confidence, 0, 1.0001, 10) AS bucket, COUNT(*)::int AS count FROM agent_runs
       WHERE created_at > NOW() - ($1 || ' days')::interval AND mode = 'trust' AND confidence IS NOT NULL ${scope}
       GROUP BY 1 ORDER BY 1`,
      params,
    ),
  ]);
  return { ...totals.rows[0], routes: routes.rows, daily: daily.rows, histogram: levels.rows };
}

export async function recentRuns(limit = 20) {
  const { rows } = await query(
    `SELECT r.id, r.query, r.route, r.confidence, r.level, r.latency_ms, r.status, r.created_at, u.name AS user_name
     FROM agent_runs r LEFT JOIN users u ON u.id = r.user_id
     WHERE r.mode = 'trust' ORDER BY r.created_at DESC LIMIT $1`,
    [limit],
  );
  return rows;
}
