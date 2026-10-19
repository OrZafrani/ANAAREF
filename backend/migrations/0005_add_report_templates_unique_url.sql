-- Adds uniqueness on (platform, report_url) for report_templates to enable
-- idempotent ON CONFLICT upserts during seed loading and catalog syncing.

-- Up Migration

CREATE UNIQUE INDEX report_templates_platform_report_url_key
    ON report_templates (platform, report_url);

-- Down Migration

DROP INDEX report_templates_platform_report_url_key;
