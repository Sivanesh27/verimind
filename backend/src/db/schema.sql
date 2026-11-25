-- VeriMind schema (idempotent; runs on every boot)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  password_hash  TEXT,
  google_id      TEXT UNIQUE,
  avatar_url     TEXT,
  role           TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'reviewer', 'admin')),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  purpose     TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
  attempts    INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_codes_email ON email_codes (email, purpose);

CREATE TABLE IF NOT EXISTS agent_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_id    UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  query        TEXT NOT NULL,
  mode         TEXT NOT NULL DEFAULT 'trust' CHECK (mode IN ('trust', 'baseline')),
  status       TEXT NOT NULL DEFAULT 'running',
  route        TEXT,
  confidence   REAL,
  level        TEXT,
  answer       TEXT,
  explanation  JSONB NOT NULL DEFAULT '[]',
  signals      JSONB NOT NULL DEFAULT '{}',
  steps        JSONB NOT NULL DEFAULT '[]',
  sources      JSONB NOT NULL DEFAULT '[]',
  latency_ms   INT,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_runs_user ON agent_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_created ON agent_runs (created_at DESC);

CREATE TABLE IF NOT EXISTS escalations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  reviewer_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations (status, created_at DESC);

CREATE TABLE IF NOT EXISTS eval_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'running',
  total       INT NOT NULL DEFAULT 0,
  completed   INT NOT NULL DEFAULT 0,
  results     JSONB NOT NULL DEFAULT '[]',
  summary     JSONB,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
