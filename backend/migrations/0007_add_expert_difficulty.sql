-- Simulations difficulty: add expert level used by the frontend builder.
-- Up Migration

ALTER TYPE simulation_difficulty ADD VALUE IF NOT EXISTS 'expert';

-- Down Migration
-- (PostgreSQL cannot drop enum values; restoring requires recreating the type.)
