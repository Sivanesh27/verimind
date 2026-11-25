import 'dotenv/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseGpu(v) {
  if (!v || v === 'false' || v === 'cpu') return false;
  return v; // 'auto' | 'cuda' | 'vulkan' | 'metal'
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 8080),

  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  corsOrigins: list(process.env.CORS_ORIGINS || 'http://localhost:5173'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  adminEmails: list(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase()),

  // LLM: "local" runs the GGUF model in the project root; "anthropic" uses the Claude API.
  llmProvider: (process.env.LLM_PROVIDER || 'local').toLowerCase(),
  local: {
    modelPath: resolve(backendRoot, process.env.LLM_MODEL_PATH || '../LLM.gguf'),
    modelUrl: process.env.LLM_MODEL_URL || null,
    modelToken: process.env.LLM_MODEL_TOKEN || null,
    modelName: process.env.LLM_MODEL_NAME || 'Mistral 7B Instruct v0.2 (GGUF)',
    contextSize: Number(process.env.LLM_CONTEXT_SIZE || 6144),
    threads: Number(process.env.LLM_THREADS || 0), // 0 = auto
    // "false" = CPU only (safe default for integrated GPUs); "auto", "cuda", "vulkan" or "metal" to offload.
    gpu: parseGpu(process.env.LLM_GPU),
    samples: Number(process.env.LLM_SAMPLES ?? 1),
  },
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  model: process.env.LLM_MODEL || 'claude-opus-5-5',

  googleClientId: process.env.GOOGLE_CLIENT_ID,

  brevoApiKey: process.env.BREVO_API_KEY,
  mailFromEmail: process.env.MAIL_FROM_EMAIL || 'no-reply@verimind.app',
  mailFromName: process.env.MAIL_FROM_NAME || 'VeriMind',

  thresholds: {
    high: Number(process.env.CONFIDENCE_HIGH || 0.8),
    medium: Number(process.env.CONFIDENCE_MEDIUM || 0.55),
  },
};
