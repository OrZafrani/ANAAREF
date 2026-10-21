import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rateLimit, type RateLimitStore } from './rateLimit.js';

// An in-memory store with the same contract as the PostgreSQL one.
function memoryStore() {
  const hits = new Map<string, string>();
  let nextId = 1;
  const store: RateLimitStore = {
    take: vi.fn(async (key: string, limit: number) => {
      if ([...hits.values()].filter((hitKey) => hitKey === key).length >= limit) {
        return { allowed: false as const, retryAfterS: 42 };
      }
      const hitId = String(nextId++);
      hits.set(hitId, key);
      return { allowed: true as const, hitId };
    }),
    release: vi.fn(async (_key: string, hitId: string) => { hits.delete(hitId); }),
  };
  return store;
}

let server: Server | undefined;

async function start(store: RateLimitStore, status = 202) {
  const app = express();
  app.set('trust proxy', true);
  app.post('/', rateLimit({ store, limit: 2, windowS: 60, message: (s) => `Try again in ${s} seconds.` }),
    (_req, res) => { res.status(status).json({ ok: status < 400 }); });
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(503).json({ error: 'Database unavailable.' });
  });
  server = app.listen(0);
  await new Promise((resolve) => server!.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  return (ip = '203.0.113.1') => fetch(url, { method: 'POST', headers: { 'X-Forwarded-For': ip } });
}

describe('rateLimit', () => {
  afterEach(async () => {
    await new Promise((resolve) => server?.close(resolve));
    server = undefined;
  });

  it('allows the limit, then answers 429 with Retry-After', async () => {
    const post = await start(memoryStore());
    expect((await post()).status).toBe(202);
    expect((await post()).status).toBe(202);
    const blocked = await post();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('42');
    await expect(blocked.json()).resolves.toEqual({ error: 'Try again in 42 seconds.' });
  });

  it('counts each client IP separately', async () => {
    const post = await start(memoryStore());
    await post('203.0.113.1');
    await post('203.0.113.1');
    expect((await post('203.0.113.1')).status).toBe(429);
    expect((await post('203.0.113.2')).status).toBe(202);
  });

  it('gives back the hit of a failed request', async () => {
    const store = memoryStore();
    const post = await start(store, 502);
    expect((await post()).status).toBe(502);
    await vi.waitFor(() => expect(store.release).toHaveBeenCalledWith('203.0.113.1', '1'));
    expect((await post()).status).toBe(502);
    expect((await post()).status).toBe(502);
    await vi.waitFor(() => expect(store.release).toHaveBeenCalledTimes(3));
  });

  it('fails closed when the store is unavailable', async () => {
    const store = memoryStore();
    vi.mocked(store.take).mockRejectedValueOnce(new Error('connection refused'));
    const post = await start(store);
    expect((await post()).status).toBe(503);
  });
});
