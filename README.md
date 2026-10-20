# ANAAREF

## AI simulation builder (frontend demo)

Run `npm run dev -w frontend`, then choose the AI option under "New simulation",
or open `/simulations/ai`. The existing manual builder and content library are
unchanged.

The AI builder is a local, deterministic demonstration, **not an AI integration**:

- Describe a scenario in Hebrew, adjust settings, generate reports, edit/remove
  them, add copies from the demo library, and review before saving.
- Chat recognizes simple difficulty words and durations such as `20 דקות`.
  It retains the conversation as report context; it does not perform real
  incident extraction, casualty inference, or language-model reasoning.
- Generation produces `round(duration_minutes * reports_per_minute)` reports.
  Duplicate, false, and background-noise counts are rounded down; the remaining
  reports are originals. Their combined percentage must be below 100.
- Generated timestamps are synthetic UTC values anchored to draft creation.
  Delivery times are stored separately as `dispatch_offset_s`.
- Save and save-as-draft are available only in the final review step and
  persist full reports, settings, and conversation under
  `cobra_ai_simulations_v1` in this browser's `localStorage`. The dashboard's
  separate AI section can reopen or delete them. Explicitly save drafts before
  leaving; clearing browser storage deletes them.
- No backend writes, AI requests, or simulation execution occur. Even the
  library picker uses local fixtures in this flow; its existing API-backed
  behavior remains the default everywhere else.

`frontend/src/lib/aiSimulation.ts` exposes the asynchronous mock chat,
generation, and library methods for replacement by the AI-team integration.
`frontend/src/types/aiSimulation.ts` separates DB-shaped simulation/report
fields from UI generation settings and report labels. Real `report_id` hashing
is intentionally deferred to the backend; `client_id` is only a UI identity.
Reality isolation (`reality_id: 1`) and unknown-vs-zero casualty counts are
preserved.

Validation: `npm run test -w frontend -- --run` and
`npm run build -w frontend`.