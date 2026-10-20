-- Allow only one started run across all simulations.

-- Up Migration

DROP INDEX simulation_runs_one_started_per_simulation_key;

CREATE UNIQUE INDEX simulation_runs_one_started_key
    ON simulation_runs ((status)) WHERE status = 'started';

-- Down Migration

DROP INDEX simulation_runs_one_started_key;

CREATE UNIQUE INDEX simulation_runs_one_started_per_simulation_key
    ON simulation_runs (simulation_id) WHERE status = 'started';
