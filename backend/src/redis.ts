import { Redis } from 'ioredis';
import { config } from './config.js';

export const redis = new Redis(config.redis.url, {
  // While Redis is down, fail commands at once instead of queueing them until it's back.
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  commandTimeout: 2000,
});

// ioredis reconnects on its own and emits an error per attempt; log once per outage.
let down = false;
redis.on('error', (error: Error) => {
  if (down) return;
  down = true;
  console.error('Redis connection failed:', error.message);
});
redis.on('ready', () => {
  if (down) console.log('Redis connection restored');
  down = false;
});
