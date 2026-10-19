-- Simulations, the reports they dispatch, and their runs.

-- Up Migration

CREATE TABLE cobra.simulations (
    id            uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text      NOT NULL,
    description   text,
    created_at    timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    updated_at    timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    difficulty    cobra.simulation_difficulty    NOT NULL,
    -- Set by the user. Not validated against dispatch offsets (warn in the API if needed).
    length_s      integer   NOT NULL,
    ai_generated  boolean   NOT NULL DEFAULT false,
    target_system cobra.simulation_target_system NOT NULL,
    -- Need not match the reality of the reports in the simulation.
    reality_id    integer   NOT NULL DEFAULT 1,

    CONSTRAINT simulations_reality_id_fkey
        FOREIGN KEY (reality_id) REFERENCES cobra.realities (id) ON DELETE RESTRICT,
    -- Simulations never run in the real world.
    CONSTRAINT simulations_reality_id_check CHECK (reality_id <> 0),
    CONSTRAINT simulations_length_s_check CHECK (length_s > 0)
);

CREATE INDEX simulations_reality_id_idx ON cobra.simulations (reality_id);

CREATE TRIGGER simulations_set_updated_at
    BEFORE UPDATE ON cobra.simulations
    FOR EACH ROW EXECUTE FUNCTION cobra.set_updated_at('updated_at');

-- The scheduler sends each report at run.started_at + dispatch_offset_s.
-- The same report may appear several times in one simulation at different offsets.
CREATE TABLE cobra.report_in_simulation (
    simulation_id     uuid    NOT NULL,
    report_id         bigint  NOT NULL,
    -- Seconds from simulation start.
    dispatch_offset_s integer NOT NULL,

    -- Column order puts dispatch_offset_s second so the primary key index also serves
    -- the scheduler's ordered read: WHERE simulation_id = $1 ORDER BY dispatch_offset_s.
    CONSTRAINT report_in_simulation_pkey PRIMARY KEY (simulation_id, dispatch_offset_s, report_id),
    -- Deleting a simulation removes its rows.
    CONSTRAINT report_in_simulation_simulation_id_fkey
        FOREIGN KEY (simulation_id) REFERENCES cobra.simulations (id) ON DELETE CASCADE,
    -- A report cannot be deleted while a simulation uses it.
    CONSTRAINT report_in_simulation_report_id_fkey
        FOREIGN KEY (report_id) REFERENCES cobra.reports (report_id) ON DELETE RESTRICT,
    CONSTRAINT report_in_simulation_dispatch_offset_s_check CHECK (dispatch_offset_s >= 0)
);

CREATE INDEX report_in_simulation_report_id_idx ON cobra.report_in_simulation (report_id);

CREATE TABLE cobra.simulation_runs (
    id            uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id uuid      NOT NULL,
    started_at    timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    completed_at  timestamp,
    -- completed = finished normally, stopped = manual stop, failed = error.
    status        cobra.simulation_run_status NOT NULL DEFAULT 'started',

    -- A simulation cannot be deleted while it has runs.
    CONSTRAINT simulation_runs_simulation_id_fkey
        FOREIGN KEY (simulation_id) REFERENCES cobra.simulations (id) ON DELETE RESTRICT,
    -- Only started runs have a NULL completed_at.
    CONSTRAINT simulation_runs_completed_at_check CHECK ((status = 'started') = (completed_at IS NULL)),
    CONSTRAINT simulation_runs_completed_after_started_check CHECK (completed_at >= started_at)
);

CREATE INDEX simulation_runs_simulation_id_started_at_idx
    ON cobra.simulation_runs (simulation_id, started_at);

-- At most one started run per simulation.
CREATE UNIQUE INDEX simulation_runs_one_started_per_simulation_key
    ON cobra.simulation_runs (simulation_id) WHERE status = 'started';

-- Down Migration

DROP TABLE cobra.simulation_runs;
DROP TABLE cobra.report_in_simulation;
DROP TABLE cobra.simulations;
