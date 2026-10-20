-- Fields the DE team's ENRICHED_REPORT schema (shared/contracts/enriched_report.py) requires.
-- Defaults suit synthetic text-only reports; existing rows get them too.

-- Up Migration

ALTER TABLE reports
    -- e.g. {text,photo}
    ADD COLUMN media_type text[] NOT NULL DEFAULT '{text}',
    -- e.g. {security}
    ADD COLUMN categories text[] NOT NULL DEFAULT '{}';

ALTER TABLE report_templates
    ADD COLUMN media_type text[] NOT NULL DEFAULT '{text}',
    ADD COLUMN categories text[] NOT NULL DEFAULT '{}';

-- Down Migration

ALTER TABLE report_templates
    DROP COLUMN categories,
    DROP COLUMN media_type;

ALTER TABLE reports
    DROP COLUMN categories,
    DROP COLUMN media_type;
