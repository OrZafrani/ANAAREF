-- Mirrors the DataForge ENRICHED_REPORT contract so historical live reports load as is.

-- Up Migration

CREATE TABLE cobra.reports (
    -- xxhash64 of reality + platform + canonical report_url, computed by the writer.
    report_id               bigint    PRIMARY KEY,
    -- 0 = real, non-zero = simulated.
    reality_id              integer   NOT NULL DEFAULT 1,
    -- Template the report was created from. NULL for live-pipeline and hand-built reports.
    template_id             uuid,

    schema_version          integer   NOT NULL,
    is_official             boolean   NOT NULL,
    platform                text      NOT NULL,
    account_name            text,
    channel_name            text,
    report_url              text      NOT NULL,
    report_title            text,
    original_language       text,
    matches                 text[],
    published_at            timestamp,
    happened_at             timestamp,
    collected_at            timestamp NOT NULL,
    original_content        text      NOT NULL,
    translated_content      text,
    threat_level            integer,
    country                 text,
    city                    text,
    lat                     double precision,
    long                    double precision,
    -- NULL = unknown, 0 = reported zero. Never coerce one into the other.
    red_injured_count       integer,
    red_death_count         integer,
    blue_injured_count      integer,
    blue_death_count        integer,
    fastbreak_model_version text,

    CONSTRAINT reports_reality_id_fkey
        FOREIGN KEY (reality_id) REFERENCES cobra.realities (id) ON DELETE RESTRICT,
    CONSTRAINT reports_template_id_fkey
        FOREIGN KEY (template_id) REFERENCES cobra.report_templates (id) ON DELETE SET NULL,
    -- report_id hashes the reality, so the same URL in two realities is two rows.
    CONSTRAINT reports_reality_id_platform_report_url_key UNIQUE (reality_id, platform, report_url),

    CONSTRAINT reports_threat_level_check CHECK (threat_level BETWEEN 0 AND 100),
    CONSTRAINT reports_original_language_check CHECK (original_language ~ '^[a-z]{2}$'),
    CONSTRAINT reports_country_check CHECK (country ~ '^[A-Z]{2}$'),
    CONSTRAINT reports_lat_check CHECK (lat BETWEEN -90 AND 90),
    CONSTRAINT reports_long_check CHECK (long BETWEEN -180 AND 180),
    CONSTRAINT reports_counts_check CHECK (
        red_injured_count >= 0 AND red_death_count >= 0
        AND blue_injured_count >= 0 AND blue_death_count >= 0
    )
);

-- Serves ON DELETE SET NULL from report_templates and "reports from this template" lookups.
CREATE INDEX reports_template_id_idx ON cobra.reports (template_id);

-- Down Migration

DROP TABLE cobra.reports;
