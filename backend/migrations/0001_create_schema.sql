-- Enum types, realities and shared helpers. All objects live in the public schema.
--
-- Every timestamp column is a plain `timestamp` (without time zone) holding UTC.
-- Defaults use `now() AT TIME ZONE 'utc'` so they do not depend on the server time zone.
-- gen_random_uuid() is built in from PostgreSQL 13.

-- Up Migration

CREATE TYPE simulation_difficulty AS ENUM ('easy', 'medium', 'hard');

CREATE TYPE simulation_target_system AS ENUM ('specter', 'combat');

CREATE TYPE simulation_run_status AS ENUM ('started', 'completed', 'stopped', 'failed');

-- BEFORE UPDATE trigger: sets the column named by the first trigger argument to the current UTC time.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], now() AT TIME ZONE 'utc'));
    RETURN NEW;
END;
$$;

-- 0 = the real world, 1 = the default simulated reality. Both are seeded here.
CREATE TABLE realities (
    id   integer PRIMARY KEY,
    name text    NOT NULL,

    CONSTRAINT realities_name_key UNIQUE (name),
    CONSTRAINT realities_id_check CHECK (id >= 0)
);

INSERT INTO realities (id, name) VALUES
    (0, 'real'),
    (1, 'simulation');

-- Down Migration

DROP TABLE realities;

DROP FUNCTION set_updated_at();

DROP TYPE simulation_run_status;
DROP TYPE simulation_target_system;
DROP TYPE simulation_difficulty;
