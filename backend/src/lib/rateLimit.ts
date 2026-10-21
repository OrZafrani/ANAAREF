import type { Request, RequestHandler } from 'express';

export type RateLimitResult =
  | { allowed: true; hitId: string }
  | { allowed: false; retryAfterS: number };

export interface RateLimitStore {
  // Records a hit for `key`, unless it already has `limit` hits in the last `windowS` seconds.
  take(key: string, limit: number, windowS: number): Promise<RateLimitResult>;
  // Gives back a hit, e.g. when its request failed.
  release(key: string, hitId: string): Promise<void>;
}

interface RateLimitOptions {
  store: RateLimitStore;
  limit: number;
  windowS: number;
  message: (retryAfterS: number) => string;
}

// Keyed by IP until SSO lands. Behind a reverse proxy this needs TRUST_PROXY,
// or every client shares the proxy's address.
export function clientKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

// Answers 429 with Retry-After once a client is over the limit.
// Requests that fail (status >= 400) don't count against it.
export function rateLimit({ store, limit, windowS, message }: RateLimitOptions): RequestHandler {
  return async (req, res, next) => {
    try {
      const key = clientKey(req);
      const result = await store.take(key, limit, windowS);
      if (!result.allowed) {
        res.set('Retry-After', String(result.retryAfterS));
        res.status(429).json({ error: message(result.retryAfterS) });
        return;
      }
      res.on('finish', () => {
        if (res.statusCode < 400) return;
        store.release(key, result.hitId).catch((error: unknown) => {
          console.error('Releasing a rate limit hit failed:', error instanceof Error ? error.message : error);
        });
      });
      next();
    } catch (error) { next(error); }
  };
}
