/**
 * Checks our messages against the DE team's ENRICHED_REPORT contract.
 *
 * shared/contracts/enriched_report.schema.json is generated from enriched_report.py.
 * When DE sends a new version, replace both files (see shared/contracts/README.md);
 * this test then shows what our messages no longer match.
 */
import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildReportMessage } from './reportMessage.js';
import { dispatchRow } from './testFixtures.js';

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../../../shared/contracts/enriched_report.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const validate = new Ajv2020({ allErrors: true }).compile(schema);

const sentAt = new Date('2026-10-25T10:00:00.000Z');

const messages = {
  'a complete report': dispatchRow(),
  'a report with every nullable field null': dispatchRow({
    report_title: null, published_at: null, happened_at: null,
    red_injured_count: null, red_death_count: null, blue_injured_count: null, blue_death_count: null,
  }),
  'a Hebrew report without a translation': dispatchRow({ original_language: 'he', translated_content: null }),
};

describe('ENRICHED_REPORT contract', () => {
  it.each(Object.entries(messages))('accepts %s', (_case, row) => {
    const report = JSON.parse(buildReportMessage(row, sentAt).value);
    validate(report);
    expect(validate.errors ?? []).toEqual([]);
  });

  it('sends exactly the contract fields, in its order', () => {
    const report = JSON.parse(buildReportMessage(dispatchRow(), sentAt).value);
    expect(Object.keys(report)).toEqual(Object.keys(schema.properties));
  });

  it('writes timestamps like the contract example ("2026-10-19 10:00")', () => {
    const report = JSON.parse(buildReportMessage(dispatchRow(), sentAt).value);
    for (const field of ['published_at', 'collected_at', 'happened_at']) {
      expect(report[field]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    }
  });
});
