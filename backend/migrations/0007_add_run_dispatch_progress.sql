-- Dispatch progress for the scheduler, so a run can resume after a restart
-- and a failed run shows where it stopped.

-- Up Migration

ALTER TABLE simulation_runs
    -- Last report confirmed by Kafka, in dispatch order. NULL until the first send.
    ADD COLUMN cursor_offset_s  integer,
    ADD COLUMN cursor_report_id bigint,
    ADD COLUMN dispatched_count integer NOT NULL DEFAULT 0,
    -- Why the run failed. Set only on failed runs.
    ADD COLUMN failure_reason   text,

    ADD CONSTRAINT simulation_runs_cursor_check
        CHECK ((cursor_offset_s IS NULL) = (cursor_report_id IS NULL)),
    ADD CONSTRAINT simulation_runs_dispatched_count_check CHECK (dispatched_count >= 0),
    ADD CONSTRAINT simulation_runs_failure_reason_check
        CHECK (failure_reason IS NULL OR status = 'failed');

-- A started run reads report_in_simulation in order and keeps a cursor into it,
-- so a report added before the cursor would never be sent. Block changes until the run ends.
CREATE FUNCTION block_report_in_simulation_changes_while_running() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM simulation_runs
        WHERE status = 'started' AND simulation_id IN (OLD.simulation_id, NEW.simulation_id)
    ) THEN
        RAISE EXCEPTION 'Simulation has a started run; stop it before changing its reports'
            USING ERRCODE = 'object_in_use';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER report_in_simulation_block_while_running
    BEFORE INSERT OR UPDATE OR DELETE ON report_in_simulation
    FOR EACH ROW EXECUTE FUNCTION block_report_in_simulation_changes_while_running();

-- Down Migration

DROP TRIGGER report_in_simulation_block_while_running ON report_in_simulation;
DROP FUNCTION block_report_in_simulation_changes_while_running();

ALTER TABLE simulation_runs
    DROP COLUMN failure_reason,
    DROP COLUMN dispatched_count,
    DROP COLUMN cursor_report_id,
    DROP COLUMN cursor_offset_s;
