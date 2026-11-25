import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { errorHandler, notFound } from './middleware/error.js';
import { describeLlm } from './agent/llm.js';
import authRoutes from './routes/auth.routes.js';
import agentRoutes from './routes/agent.routes.js';
import escalationRoutes from './routes/escalation.routes.js';
import evalRoutes from './routes/eval.routes.js';
import monitorRoutes from './routes/monitor.routes.js';
import adminRoutes from './routes/admin.routes.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render terminates TLS in front of us
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));

  // Health check for Render + UptimeRobot (also keeps the free instance warm).
  app.get(['/health', '/api/health'], async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', db: 'ok', llm: describeLlm(), uptime: Math.round(process.uptime()), time: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'down' });
    }
  });
  app.get('/', (_req, res) => res.json({ name: 'VeriMind API', docs: '/health' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/agent', agentRoutes);
  app.use('/api/escalations', escalationRoutes);
  app.use('/api/eval', evalRoutes);
  app.use('/api/monitor', monitorRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
