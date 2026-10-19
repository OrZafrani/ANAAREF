-- Template library: a fixed two-level category tree and the report templates in it.

-- Up Migration

CREATE TABLE template_categories (
    id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,

    CONSTRAINT template_categories_name_key UNIQUE (name)
);

-- Deleting a category deletes its sub-categories (blocked while templates use them, see below).
CREATE TABLE template_sub_categories (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL,
    name        text NOT NULL,

    CONSTRAINT template_sub_categories_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES template_categories (id) ON DELETE CASCADE,
    -- Names are unique within their parent category.
    CONSTRAINT template_sub_categories_category_id_name_key UNIQUE (category_id, name),
    -- Target of the composite foreign key from report_templates.
    CONSTRAINT template_sub_categories_category_id_id_key UNIQUE (category_id, id)
);

-- Every reports column except report_id and reality_id, with the same types and nullability,
-- so a template can be copied into reports as is.
CREATE TABLE report_templates (
    id                      uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id             uuid      NOT NULL,
    sub_category_id         uuid,
    template_created_at     timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    template_updated_at     timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),

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
    red_injured_count       integer,
    red_death_count         integer,
    blue_injured_count      integer,
    blue_death_count        integer,
    fastbreak_model_version text,

    CONSTRAINT report_templates_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES template_categories (id) ON DELETE RESTRICT,
    -- Guarantees the sub-category belongs to the template's category.
    -- MATCH SIMPLE (the default) skips the check when sub_category_id is NULL.
    CONSTRAINT report_templates_sub_category_fkey
        FOREIGN KEY (category_id, sub_category_id)
        REFERENCES template_sub_categories (category_id, id) ON DELETE RESTRICT,

    CONSTRAINT report_templates_threat_level_check CHECK (threat_level BETWEEN 0 AND 100),
    CONSTRAINT report_templates_original_language_check CHECK (original_language ~ '^[a-z]{2}$'),
    CONSTRAINT report_templates_country_check CHECK (country ~ '^[A-Z]{2}$'),
    CONSTRAINT report_templates_lat_check CHECK (lat BETWEEN -90 AND 90),
    CONSTRAINT report_templates_long_check CHECK (long BETWEEN -180 AND 180),
    CONSTRAINT report_templates_counts_check CHECK (
        red_injured_count >= 0 AND red_death_count >= 0
        AND blue_injured_count >= 0 AND blue_death_count >= 0
    )
);

-- Serves both foreign keys and "templates in category / sub-category" listings.
CREATE INDEX report_templates_category_id_sub_category_id_idx
    ON report_templates (category_id, sub_category_id);

CREATE TRIGGER report_templates_set_updated_at
    BEFORE UPDATE ON report_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at('template_updated_at');

-- Down Migration

DROP TABLE report_templates;
DROP TABLE template_sub_categories;
DROP TABLE template_categories;
