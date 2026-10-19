# ADR-0006: Seed Fetcher Triggering and Execution Strategy

## Status
Accepted

## Context & Problem Statement
The library seed data (~20 Hebrew Specter reports) needs to be reliably loaded into PostgreSQL so that both local development environments, automated testing suites, and production deployments have the baseline category tree and scenario templates ready. We need to decide how and when this seed loader is executed.

## Options Considered
1. **Option A (Dual Trigger: Auto-Startup Check + Dedicated CLI Script - Chosen)**:
   - On backend startup (`src/index.ts`), after database connection verification, a lightweight check runs. If the library template table is empty, it automatically triggers the seed fetcher.
   - A standalone CLI script (`npm run seed:library`) is provided for explicit invocation during CI pipelines, test setups, or manual re-seeding.
2. **Option B (CLI Script Only)**: Must be executed manually by developers or during container provisioning via entrypoint scripts.
3. **Option C (Admin API Endpoint Only)**: Requires an authenticated HTTP request to seed the database.

## Decision Outcome
Chosen option: **Option A**. Provides zero-friction onboarding for developers and automated demo readiness on startup, while keeping a dedicated CLI script for reproducible test runs and CI workflows.

## Consequences & Trade-offs
- **Positive**: Immediate out-of-the-box availability of the library on first launch; completely idempotent so repeated startup checks or script runs are safe.
- **Negative / Risks**: Must ensure startup check is fast (e.g., `SELECT EXISTS(SELECT 1 FROM report_templates LIMIT 1)`) so it adds negligible overhead to boot time.
