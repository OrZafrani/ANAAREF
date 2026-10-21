import { randomUUID } from 'node:crypto';
import { ApiError } from './api-error.js';
import type { RateLimitStore } from '../lib/rateLimit.js';
import { redis } from '../redis.js';

const KEY_PREFIX = 'ai-generation-rate:';

// A sliding window per client: a sorted set of hit IDs scored by time (ms).
// Runs atomically in Redis, so concurrent requests on any instance can't overshoot the limit,
// and uses Redis's clock, so instance clocks don't need to agree.
// Returns {1, 0} when the hit is recorded, or {0, ms until the oldest hit leaves the window}.
const TAKE_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local window = tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, tonumber(oldest[2]) + window - now}
end
redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], window)
return {1, 0}
`;

function unavailable(error: unknown): ApiError {
  console.error('AI generation rate limit check failed:', error instanceof Error ? error.message : error);
  return new ApiError('AI generation is paused because its rate limit is unavailable. Try again shortly.', 503);
}

// Rate limit hits for AI generation, in Redis so all backend instances share them.
// Fails closed: while Redis is down, generation is refused rather than unlimited.
export const aiGenerationRateLimitStore: RateLimitStore = {
  async take(key, limit, windowS) {
    const hitId = randomUUID();
    let result: [number, number];
    try {
      result = await redis.eval(TAKE_SCRIPT, 1, KEY_PREFIX + key, windowS * 1000, limit, hitId) as [number, number];
    } catch (error) {
      throw unavailable(error);
    }
    const [allowed, retryAfterMs] = result;
    return allowed === 1
      ? { allowed: true, hitId }
      : { allowed: false, retryAfterS: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  },

  async release(key, hitId) {
    await redis.zrem(KEY_PREFIX + key, hitId);
  },
};
