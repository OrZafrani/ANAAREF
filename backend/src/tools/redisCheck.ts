/**
 * Connects to Redis from backend/.env and reports whether the rate limit can use it.
 *
 *   npm run redis:check -w backend
 */
import { Redis } from 'ioredis';
import { config } from '../config.js';

const url = new URL(config.redis.url);
console.log(`Redis: ${url.host}  (TLS: ${url.protocol === 'rediss:' ? 'on' : 'off'}, user: ${url.username || 'default'})`);

const redis = new Redis(config.redis.url, {
  lazyConnect: true,
  connectTimeout: 10_000,
  maxRetriesPerRequest: 0,
  retryStrategy: () => null,
});
redis.on('error', () => undefined);

try {
  await redis.connect();
  console.log(`Connected. PING -> ${await redis.ping()}`);
  // The rate limit runs a Lua script that reads Redis's clock; managed Redis may disallow scripts.
  const [seconds] = await redis.eval(`return redis.call('TIME')`, 0) as [string, string];
  console.log(`Lua scripts work. Redis time: ${new Date(Number(seconds) * 1000).toISOString()}`);
  redis.disconnect();
} catch (error) {
  console.error('FAILED:', error instanceof Error ? error.message : error);
  redis.disconnect();
  process.exit(1);
}
