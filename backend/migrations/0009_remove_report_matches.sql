-- Up Migration

ALTER TABLE report_templates DROP COLUMN IF EXISTS matches;
ALTER TABLE reports DROP COLUMN IF EXISTS matches;

-- Down Migration

ALTER TABLE reports ADD COLUMN matches text[];
ALTER TABLE report_templates ADD COLUMN matches text[];
