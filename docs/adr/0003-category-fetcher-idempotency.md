# ADR-0003: Category Fetcher Idempotency and Manual Edit Preservation

## Status
Accepted

## Context & Problem Statement
The category system supports both automated seed loading (e.g., initial setup, re-running seed scripts, pipeline sync) and manual interactive edits via the frontend (right-click to add, rename, or edit categories and sub-categories). If the seed fetcher runs repeatedly or after manual instructor modifications, naive replacement would erase user edits or create duplicate categories.

## Options Considered
1. **Option A (Non-Destructive Upsert - Chosen)**:
   - Match categories by natural key (`name`). If found, retrieve its existing `id` and keep existing attributes. If not found, insert.
   - Match sub-categories by composite natural key `(category_id, name)`. If found, retrieve `id`; if not found, insert.
   - Match report templates by `(platform, report_url)`.
   - Never drop or overwrite custom categories or sub-categories created manually by instructors in the UI.
2. **Option B (Deterministic Seed Flag `is_system_seed`)**: Track seeded records explicitly and only refresh those, isolating user entries.
3. **Option C (Hard Sync / Reset)**: Overwrite all library categories and templates back to the raw CSV state.

## Decision Outcome
Chosen option: **Option A**. The fetcher operates non-destructively: it performs idempotent upserts based on natural keys, seamlessly adds new entities, reuses existing IDs, and preserves custom user categories and manual modifications.

## Consequences & Trade-offs
- **Positive**: High resilience; running the seed script multiple times is completely safe and non-destructive. Instructors won't lose work created in the UI.
- **Negative / Risks**: If an instructor renames a seeded category in the UI (e.g., "Natural Disasters" -> "Natural Emergencies"), a subsequent run of the seed CSV containing "Natural Disasters" will recreate "Natural Disasters" as a new category rather than detecting the rename, unless an immutable slug or key is tracked.
