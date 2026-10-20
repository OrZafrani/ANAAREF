/**
 * backend/src/lib/validate.ts
 *
 * Field-type validation, input sanitation and typed API errors for the
 * Category Fetcher REST API (Phase 3).
 *
 * SQL-injection defence (defence in depth):
 *   1. Every data access uses parameterised queries (`pg` `$1..$n` placeholders)
 *      – user input is never interpolated into SQL strings.
 *   2. Strings are sanitised here (null bytes / control characters stripped,
 *      length capped) so malformed payloads are rejected at the API boundary
 *      with 400 before they ever reach the database.
 */

import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export class ValidationError extends ApiError {
  public readonly errors: Record<string, string>;
  constructor(message: string, errors: Record<string, string>) {
    super(message, 400);
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(message, 404);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(message, 409);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

// ─── Validators ─────────────────────────────────────────────────────────────

type Validator<T> = (
  value: unknown,
) => { ok: true; value: T } | { ok: false; error: string };

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const CONTROL_RE = /[\u0000-\u001F\u007F-\u009F]/g;
const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

/** Trim, strip control characters/null bytes and cap length. */
function cleanString(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(CONTROL_RE, '').trim();
  return cleaned.length === 0 ? null : cleaned.slice(0, maxLength);
}

export function vRequiredString(maxLength = 200): Validator<string> {
  return (value) => {
    const cleaned = cleanString(value, maxLength);
    return cleaned === null
      ? { ok: false, error: 'Required non-empty string' }
      : { ok: true, value: cleaned };
  };
}

export function vOptionalString(maxLength = 1000): Validator<string | null> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return { ok: true, value: null };
    }
    const cleaned = cleanString(value, maxLength);
    return cleaned === null
      ? { ok: false, error: 'Invalid string' }
      : { ok: true, value: cleaned };
  };
}

export function vOptionalPattern(
  pattern: RegExp,
  maxLength: number,
  errorMessage: string,
): Validator<string | null> {
  const validateString = vOptionalString(maxLength);
  return (value) => {
    const result = validateString(value);
    if (!result.ok || result.value === null) return result;
    return pattern.test(result.value)
      ? result
      : { ok: false, error: errorMessage };
  };
}

export function vHttpUrl(): Validator<string> {
  const validateString = vRequiredString(2048);
  return (value) => {
    const result = validateString(value);
    if (!result.ok) return result;
    try {
      const url = new URL(result.value);
      return url.protocol === 'http:' || url.protocol === 'https:'
        ? result
        : { ok: false, error: 'HTTP or HTTPS URL expected' };
    } catch {
      return { ok: false, error: 'Valid HTTP or HTTPS URL expected' };
    }
  };
}

export function vUuid(): Validator<string> {
  return (value) => {
    if (typeof value !== 'string' || !UUID_RE.test(value)) {
      return { ok: false, error: 'Invalid UUID' };
    }
    return { ok: true, value: value };
  };
}

export function vOptionalUuid(): Validator<string | null> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return { ok: true, value: null };
    }
    return vUuid()(value);
  };
}

export function vNullable<T>(validator: Validator<T>): Validator<T | null> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return { ok: true, value: null };
    }
    return validator(value);
  };
}

export function vBoolean(): Validator<boolean> {
  return (value) => {
    if (value === true) return { ok: true, value: true };
    if (value === false) return { ok: true, value: false };
    if (value === 'true') return { ok: true, value: true };
    if (value === 'false') return { ok: true, value: false };
    return { ok: false, error: 'Boolean expected' };
  };
}

export function vInteger({
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
}: { min?: number; max?: number } = {}): Validator<number> {
  return (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
      return { ok: false, error: 'Integer expected' };
    }
    if (value < min || value > max) {
      return { ok: false, error: `Integer must be between ${min} and ${max}` };
    }
    return { ok: true, value: value };
  };
}

export function vDouble({
  min = -Infinity,
  max = Infinity,
}: { min?: number; max?: number } = {}): Validator<number> {
  return (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { ok: false, error: 'Number expected' };
    }
    if (value < min || value > max) {
      return { ok: false, error: `Number must be between ${min} and ${max}` };
    }
    return { ok: true, value: value };
  };
}

export function vIsoDate(): Validator<string> {
  return (value) => {
    if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) {
      return { ok: false, error: 'ISO-8601 timestamp expected' };
    }
    if (Number.isNaN(new Date(value).getTime())) {
      return { ok: false, error: 'Invalid timestamp' };
    }
    return { ok: true, value: value };
  };
}

export function vStringArray(): Validator<string[]> {
  return (value) => {
    if (!Array.isArray(value)) {
      return { ok: false, error: 'Array expected' };
    }
    if (value.some((item) => typeof item !== 'string')) {
      return { ok: false, error: 'String array expected' };
    }
    return {
      ok: true,
      value: value
        .map((item) => cleanString(item, 500))
        .filter((item): item is string => item !== null),
    };
  };
}
// ─── Middleware ─────────────────────────────────────────────────────────────

export interface ValidatedRequest extends Request {
  validatedBody?: Record<string, unknown>;
  validatedParams?: Record<string, unknown>;
  validatedQuery?: Record<string, unknown>;
}

function runSchema(
  schema: Record<string, Validator<unknown>>,
  values: Record<string, unknown>,
): { errors: Record<string, string>; data: Record<string, unknown> } {
  const errors: Record<string, string> = {};
  const data: Record<string, unknown> = {};
  for (const [key, validator] of Object.entries(schema)) {
    const result = validator(values[key]);
    if (result.ok) {
      data[key] = result.value;
    } else {
      errors[key] = result.error;
    }
  }
  return { errors, data };
}

export function validateBody(
  schema: Record<string, Validator<unknown>>,
  options: { partial?: boolean } = {},
) {
  return (req: ValidatedRequest, _res: Response, next: NextFunction) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {};
    const unknownFields = Object.keys(body).filter((key) => !(key in schema));
    const fields = options.partial
      ? Object.fromEntries(Object.entries(schema).filter(([key]) =>
          Object.prototype.hasOwnProperty.call(body, key)))
      : schema;
    const { errors, data } = runSchema(fields, body);
    for (const field of unknownFields) errors[field] = 'Unknown field';
    if (options.partial && Object.keys(fields).length === 0) {
      errors.body = 'At least one field is required';
    }
    if (Object.keys(errors).length > 0) {
      next(new ValidationError('Request validation failed', errors));
      return;
    }
    req.validatedBody = data;
    next();
  };
}

export function validateParams(schema: Record<string, Validator<unknown>>) {
  return (req: ValidatedRequest, _res: Response, next: NextFunction) => {
    const { errors, data } = runSchema(schema, req.params);
    if (Object.keys(errors).length > 0) {
      next(new ValidationError('Request validation failed', errors));
      return;
    }
    req.validatedParams = data;
    next();
  };
}

export function validateQuery(schema: Record<string, Validator<unknown>>) {
  return (req: ValidatedRequest, _res: Response, next: NextFunction) => {
    const { errors, data } = runSchema(schema, req.query);
    if (Object.keys(errors).length > 0) {
      next(new ValidationError('Request validation failed', errors));
      return;
    }
    req.validatedQuery = data;
    next();
  };
}

export function asyncHandler(
  fn: (req: ValidatedRequest, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: ValidatedRequest, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
}

export const apiErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ValidationError) {
    res.status(error.statusCode).json({ error: error.message, details: error.errors });
    return;
  }
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  const databaseCode = typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: string }).code
    : undefined;
  if (databaseCode === '23505') {
    res.status(409).json({ error: 'A record with this name or URL already exists' });
    return;
  }
  if (databaseCode === '23503') {
    res.status(409).json({ error: 'The requested change conflicts with existing records' });
    return;
  }
  if (databaseCode === '23514') {
    res.status(400).json({ error: 'The submitted data violates a database constraint' });
    return;
  }

  console.error('[api] Unhandled request error:', error);
  res.status(500).json({ error: 'Internal server error' });
};