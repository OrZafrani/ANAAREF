import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRedis } = vi.hoisted(() => ({ mockRedis: { eval: vi.fn(), zrem: vi.fn() } }));

vi.mock('../redis.js', () => ({ redis: mockRedis }));

import { aiGenerationRateLimitStore } from './aiGenerationRateLimitStore.js';

describe('aiGenerationRateLimitStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('records a hit under the limit in the client key, with the window in ms', async () => {
    mockRedis.eval.mockResolvedValue([1, 0]);
    const result = await aiGenerationRateLimitStore.take('203.0.113.1', 2, 60);
    expect(result).toEqual({ allowed: true, hitId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    const [script, keyCount, key, windowMs, limit, hitId] = mockRedis.eval.mock.calls[0];
    expect(script).toContain('ZREMRANGEBYSCORE');
    expect([keyCount, key, windowMs, limit]).toEqual([1, 'ai-generation-rate:203.0.113.1', 60000, 2]);
    expect(hitId).toBe(result.allowed && result.hitId);
  });

  it.each([[36_001, 37], [200, 1], [0, 1]])('refuses at the limit, waiting %i ms as %i seconds', async (ms, seconds) => {
    mockRedis.eval.mockResolvedValue([0, ms]);
    await expect(aiGenerationRateLimitStore.take('203.0.113.1', 2, 60))
      .resolves.toEqual({ allowed: false, retryAfterS: seconds });
  });

  it('fails closed with 503 when Redis is unavailable', async () => {
    mockRedis.eval.mockRejectedValue(new Error("Stream isn't writeable and enableOfflineQueue options is false"));
    await expect(aiGenerationRateLimitStore.take('203.0.113.1', 2, 60)).rejects.toMatchObject({ statusCode: 503 });
  });

  it('removes a released hit from its client key', async () => {
    mockRedis.zrem.mockResolvedValue(1);
    await aiGenerationRateLimitStore.release('203.0.113.1', 'hit-1');
    expect(mockRedis.zrem).toHaveBeenCalledWith('ai-generation-rate:203.0.113.1', 'hit-1');
  });
});
