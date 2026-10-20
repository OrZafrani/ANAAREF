/**
 * backend/src/lib/security.ts
 *
 * HTTP hardening for the API: response headers, the CORS allow-list and a
 * per-client rate limit on requests that change data.
 */

import type { CorsOptions } from 'cors';
import type { NextFunction, Request, Response } from 'express';

/**
 * Headers for a JSON-only API: nothing it returns should be rendered, framed,
 * sniffed into another type, cached, or read by another site.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  next();
}

/**
 * Only the listed origins may call the API from a browser. With an empty list no
 * CORS headers are sent, which is right when the frontend reaches the API through
 * the Vite proxy or a reverse proxy on the same origin.
 */
export function corsOptions(allowedOrigins: string[]): CorsOptions {
  const allowed = new Set(allowedOrigins);
  return {
    origin: (origin, callback) => callback(null, origin !== undefined && allowed.has(origin)),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type'],
    maxAge: 600,
  };
}

interface RateLimitOptions {
  /** Requests allowed per client in each window. */
  max: number;
  windowMs: number;
  now?: () => number;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Fixed-window limit per client IP for requests that change data. In-memory, so it
 * applies per backend process; behind a shared proxy every user shares one IP.
 */
export function writeRateLimit({ max, windowMs, now = Date.now }: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const time = now();
    const key = req.ip ?? 'unknown';
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= time) {
      // Drop expired windows as we go so the map does not grow without bound.
      for (const [client, window] of hits) {
        if (window.resetAt <= time) hits.delete(client);
      }
      entry = { count: 0, resetAt: time + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - time) / 1000)));
      res.status(429).json({ error: 'Too many requests, try again shortly' });
      return;
    }
    next();
  };
}

/**
 * POST and PATCH must declare a JSON body. A cross-site form can only send simple content types,
 * which a browser sends without a CORS preflight; requiring JSON forces the preflight, which the
 * CORS allow-list then refuses. This also covers routes with no body, such as starting a run.
 */
export function requireJsonForWrites(req: Request, res: Response, next: NextFunction) {
  // Read the header itself: req.is() returns null for a request without a body.
  const mediaType = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if ((req.method === 'POST' || req.method === 'PATCH') && mediaType !== 'application/json') {
    res.status(415).json({ error: 'Content-Type must be application/json' });
    return;
  }
  next();
}
