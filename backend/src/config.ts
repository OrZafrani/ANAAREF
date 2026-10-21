import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load backend/.env before reading settings (this module can be imported before index.ts runs).
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

function intFromEnv(name: string, fallback: number, min = 0): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min}, got "${raw}"`);
  }
  return value;
}

// Express "trust proxy": hop count, true/false, or comma-separated proxy addresses.
function trustProxyFromEnv(): boolean | number | string {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw || raw === 'false') return false;
  if (raw === 'true') return true;
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

export const config = {
  trustProxy: trustProxyFromEnv(),
  redis: {
    url: process.env.REDIS_URL?.trim() || 'redis://localhost:6379',
  },
  aiGeneration: {
    // Generations each client may start per window, across all backend instances.
    rateLimit: intFromEnv('AI_GENERATION_RATE_LIMIT', 2, 1),
    rateWindowS: intFromEnv('AI_GENERATION_RATE_WINDOW_S', 60, 1),
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092')
      .split(',')
      .map((broker) => broker.trim())
      .filter(Boolean),
    clientId: process.env.KAFKA_CLIENT_ID ?? 'cobra-simulation-engine',
    reportsTopic: process.env.KAFKA_TOPIC_ENRICHED_REPORTS ?? 'reports.enriched',
    producerRetries: intFromEnv('KAFKA_PRODUCER_RETRIES', 5),
    // How long one send keeps retrying before it fails (and fails the run).
    deliveryTimeoutMs: intFromEnv('KAFKA_DELIVERY_TIMEOUT_MS', 60_000, 1),
    // Optional auth. Leave KAFKA_SASL_USERNAME unset for a plaintext local broker.
    saslUsername: process.env.KAFKA_SASL_USERNAME?.trim() || undefined,
    saslPassword: process.env.KAFKA_SASL_PASSWORD,
    saslMechanism: (process.env.KAFKA_SASL_MECHANISM?.trim().toLowerCase() || 'scram-sha-512') as
      | 'plain'
      | 'scram-sha-256'
      | 'scram-sha-512',
    // Set KAFKA_SSL=true (or give a CA file) to use TLS.
    ssl: process.env.KAFKA_SSL === 'true' || Boolean(process.env.KAFKA_SSL_CA_LOCATION?.trim()),
    sslCaLocation: process.env.KAFKA_SSL_CA_LOCATION?.trim() || undefined,
  },
  scheduler: {
    batchSize: intFromEnv('SCHEDULER_BATCH_SIZE', 100, 1),
    // A started run is failed once it passes its length (or last offset) plus this grace.
    runTimeoutGraceS: intFromEnv('RUN_TIMEOUT_GRACE_S', 300),
    watchdogIntervalS: intFromEnv('SCHEDULER_WATCHDOG_INTERVAL_S', 30, 1),
  },
};
