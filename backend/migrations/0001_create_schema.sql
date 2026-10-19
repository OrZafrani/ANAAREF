-- Cobra schema, enum types, realities and shared helpers.
--
-- Every timestamp column is a plain `timestamp` (without time zone) holding UTC.
-- Defaults use `now() AT TIME ZONE 'utc'` so they do not depend on the server time zone.
-- gen_random_uuid() is built in from PostgreSQL 13.

-- Up Migration

CREATE SCHEMA IF NOT EXISTS cobra;

CREATE TYPE cobra.simulation_difficulty AS ENUM ('easy', 'medium', 'hard');

CREATE TYPE cobra.simulation_target_system AS ENUM ('specter', 'combat');

CREATE TYPE cobra.simulation_run_status AS ENUM ('started', 'completed', 'stopped', 'failed');

-- BEFORE UPDATE trigger: sets the column named by the first trigger argument to the current UTC time.
CREATE FUNCTION cobra.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], now() AT TIME ZONE 'utc'));
    RETURN NEW;
END;
$$;

-- 0 = the real world, 1 = the default simulated reality. Both are seeded here.
CREATE TABLE cobra.realities (
    id   integer PRIMARY KEY,
    name text    NOT NULL,

    CONSTRAINT realities_name_key UNIQUE (name),
    CONSTRAINT realities_id_check CHECK (id >= 0)
);

INSERT INTO cobra.realities (id, name) VALUES
    (0, 'real'),
    (1, 'simulation');

-- Down Migration

DROP TABLE cobra.realities;

DROP FUNCTION cobra.set_updated_at();

DROP TYPE cobra.simulation_run_status;
DROP TYPE cobra.simulation_target_system;
DROP TYPE cobra.simulation_difficulty;

-- No CASCADE: fails if anything outside these migrations was created in the schema.
DROP SCHEMA cobra;
