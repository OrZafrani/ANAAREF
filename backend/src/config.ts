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

function listFromEnv(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  http: {
    // Loopback by default; set HOST=0.0.0.0 only behind a proxy or firewall, since the API has no sign-in yet.
    host: process.env.HOST?.trim() || '127.0.0.1',
    port: intFromEnv('PORT', 4000, 1),
    // Browser origins allowed to call the API directly. Empty: same-origin only (Vite proxy / reverse proxy).
    corsOrigins: listFromEnv('CORS_ORIGINS'),
    // Requests that change data, per client IP per minute.
    writeRateLimitPerMin: intFromEnv('RATE_LIMIT_WRITES_PER_MIN', 120, 1),
    // Templates allow up to 2 × 50,000 characters of content, which can exceed 300 KB in UTF-8.
    jsonBodyLimit: '512kb',
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
  },
  scheduler: {
    batchSize: intFromEnv('SCHEDULER_BATCH_SIZE', 100, 1),
    // A started run is failed once it passes its length (or last offset) plus this grace.
    runTimeoutGraceS: intFromEnv('RUN_TIMEOUT_GRACE_S', 300),
    watchdogIntervalS: intFromEnv('SCHEDULER_WATCHDOG_INTERVAL_S', 30, 1),
  },
};
