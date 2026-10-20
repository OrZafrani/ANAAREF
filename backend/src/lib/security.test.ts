import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { corsOptions, requireJsonForWrites, securityHeaders, writeRateLimit } from './security.js';

function mockResponse() {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    setHeader: (name: string, value: string) => { headers[name] = value; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return { res: res as unknown as Response & typeof res, headers };
}

function request(method: string, ip = '10.0.0.1') {
  return { method, ip } as Request;
}

function allowedOrigin(options: ReturnType<typeof corsOptions>, origin: string | undefined) {
  let allowed: unknown;
  (options.origin as (o: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void)(
    origin,
    (_err, allow) => { allowed = allow; },
  );
  return allowed;
}

describe('securityHeaders', () => {
  it('sets headers that stop framing, sniffing, caching and cross-site reads', () => {
    const { res, headers } = mockResponse();
    const next = vi.fn();
    securityHeaders(request('GET'), res, next as NextFunction);
    expect(next).toHaveBeenCalledOnce();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(headers['Cache-Control']).toBe('no-store');
    expect(headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
  });
});

describe('corsOptions', () => {
  it('allows only listed origins', () => {
    const options = corsOptions(['http://localhost:5173']);
    expect(allowedOrigin(options, 'http://localhost:5173')).toBe(true);
    expect(allowedOrigin(options, 'https://evil.example')).toBe(false);
  });

  it('allows no cross-origin callers when the list is empty', () => {
    const options = corsOptions([]);
    expect(allowedOrigin(options, 'http://localhost:5173')).toBe(false);
    expect(allowedOrigin(options, undefined)).toBe(false);
  });
});

describe('writeRateLimit', () => {
  it('rejects writes over the limit with 429 and Retry-After', () => {
    const limit = writeRateLimit({ max: 2, windowMs: 60_000, now: () => 1_000 });
    const next = vi.fn();
    for (let i = 0; i < 2; i++) limit(request('POST'), mockResponse().res, next as NextFunction);
    const { res, headers } = mockResponse();
    limit(request('DELETE'), res, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(429);
    expect(headers['Retry-After']).toBe('60');
  });

  it('does not count reads', () => {
    const limit = writeRateLimit({ max: 1, windowMs: 60_000, now: () => 0 });
    const next = vi.fn();
    for (let i = 0; i < 5; i++) limit(request('GET'), mockResponse().res, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(5);
  });

  it('counts each client separately and resets after the window', () => {
    let time = 0;
    const limit = writeRateLimit({ max: 1, windowMs: 1_000, now: () => time });
    const next = vi.fn();

    limit(request('POST', '10.0.0.1'), mockResponse().res, next as NextFunction);
    limit(request('POST', '10.0.0.2'), mockResponse().res, next as NextFunction);
    const blocked = mockResponse();
    limit(request('POST', '10.0.0.1'), blocked.res, next as NextFunction);
    expect(blocked.res.statusCode).toBe(429);

    time = 1_000;
    limit(request('POST', '10.0.0.1'), mockResponse().res, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(3);
  });
});

describe('requireJsonForWrites', () => {
  const withType = (method: string, type: string | null) =>
    ({ method, headers: type === null ? {} : { 'content-type': type } }) as unknown as Request;

  it('rejects POST and PATCH that are not JSON, such as a cross-site form post', () => {
    for (const req of [withType('POST', 'text/plain'), withType('POST', null), withType('PATCH', 'application/x-www-form-urlencoded')]) {
      const { res } = mockResponse();
      const next = vi.fn();
      requireJsonForWrites(req, res, next as NextFunction);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(415);
    }
  });

  it('lets JSON writes, reads and deletes through', () => {
    const next = vi.fn();
    for (const req of [
      withType('POST', 'application/json'),
      withType('POST', 'Application/JSON; charset=utf-8'),
      withType('GET', null),
      withType('DELETE', null),
    ]) {
      requireJsonForWrites(req, mockResponse().res, next as NextFunction);
    }
    expect(next).toHaveBeenCalledTimes(4);
  });
});
