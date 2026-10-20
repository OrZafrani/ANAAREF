/**
 * Checks our messages against the Specter team's ENRICHED_REPORT example
 * (shared/contracts/specter_enriched_report.example.json), the format we follow.
 *
 * The example shows one value per field, not which fields may be null, so a
 * null on either side is accepted; otherwise the JSON types must match.
 * When Specter sends a new example, replace the file; this test shows what changed.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildReportMessage } from './reportMessage.js';
import { dispatchRow } from './testFixtures.js';

const examplePath = join(dirname(fileURLToPath(import.meta.url)), '../../../shared/contracts/specter_enriched_report.example.json');
const example: Record<string, unknown> = JSON.parse(readFileSync(examplePath, 'utf8'));

const jsonType = (value: unknown) => (value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value);
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const sentAt = new Date('2026-10-25T10:00:00.000Z');

const ourMessage = () => JSON.parse(buildReportMessage(dispatchRow(), sentAt).value);

describe("Specter's ENRICHED_REPORT example", () => {
  it('has exactly the same fields, in the same order', () => {
    expect(Object.keys(ourMessage())).toEqual(Object.keys(example));
  });

  it('uses the same JSON type for every field', () => {
    const ours = ourMessage();
    const mismatches = Object.keys(example)
      .filter((field) => ours[field] !== null && example[field] !== null)
      .filter((field) => jsonType(ours[field]) !== jsonType(example[field]))
      .map((field) => `${field}: ours ${jsonType(ours[field])}, Specter ${jsonType(example[field])}`);
    expect(mismatches).toEqual([]);
  });

  it('writes timestamps in the same format', () => {
    const ours = ourMessage();
    for (const field of ['published_at', 'collected_at', 'happened_at']) {
      expect(example[field]).toMatch(ISO_UTC_RE);
      expect(ours[field]).toMatch(ISO_UTC_RE);
    }
  });
});
