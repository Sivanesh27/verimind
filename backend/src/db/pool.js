import pg from 'pg';
import { env } from '../config/env.js';

const isLocal = /localhost|127\.0\.0\.1/.test(env.databaseUrl);

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  // Neon requires TLS; a local Postgres usually does not.
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => console.error('[db] idle client error:', err.message));

export const query = (text, params) => pool.query(text, params);
