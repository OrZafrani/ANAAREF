# ANAAREF

## AI simulation builder (Cobra API generation, database saving)

Run `npm run dev -w frontend`, then choose the AI option under "New simulation",
or open `/simulations/ai`. The manual builder and real content library keep
their API-backed behavior.

The AI builder generates reports through the Cobra API, proxied by our backend:

- Describe a scenario in Hebrew, adjust settings, generate reports, edit/remove
  them, add copies from the real content library, and review before saving.
- Report review uses full-width cards with timing, kind, origin, urgency and
  casualty summaries. Each card's "פרטים" action opens a left-side drawer with
  a fixed header/footer, a two-column information grid, location information,
  expandable additional fields, and edit/remove actions. Missing location
  precision is explicitly marked rather than inferred.
- Drag report handles to reorder reports between the existing delivery-time
  slots; timestamps inside report payloads stay unchanged. Up/down buttons also
  support keyboard/touch reordering and moving across pages. Reordering is
  available with the "all" filter to avoid moving hidden reports unexpectedly.
  The new order and delivery offsets are included in drafts and database saves. Generated
  headlines do not include report sequence numbers.
- Delivery timing is highlighted on each card and at the top of the report
  editor with compact, separate minutes and seconds inputs. Saving the time
  updates the report's chronological position; seconds must be 0–59 and the
  combined time cannot exceed the simulation duration.
- Simulation duration ranges from 1 to 120 minutes. The background-noise field
  (`רמת רעש רקע`) retains the API's low/medium/high options.
- The chat-shaped description entry is not a conversational AI. Sending free text
  replaces the active description, without inferring or modifying simulation
  settings. Only explicit example selection applies that example's name,
  description, difficulty, duration, rate, noise level, region, and geographic bounds.
  Users can edit the active description and regenerate; existing reports, including
  edits and library copies, are replaced only after confirmation and success.
- Generation requests `round(duration_minutes * reports_per_minute)` reports,
  capped at 100 per request. Above-limit requests are rejected, not truncated
  or split into unrelated stories. Low/medium/high noise replaces unsupported
  exact duplicate/false/background-noise percentages.
- Region, country, and valid latitude/longitude bounds are required by the
  upstream scenario contract and must be entered manually for free descriptions.
  Custom descriptions must be 10–2000 characters; use fictional names and places.
  The API currently receives 40% formal reports and 0% Arabic social posts.
- Each generation creates a new scenario ID and random seed. The API produces
  timestamps and `dispatch_offset_s`; neither is synthesized from the requested
  average rate. Offsets outside the simulation duration are rejected.
- Save and save-as-draft are available in the header and final review step.
  Drafts can be saved before generating reports; full saving validates the
  settings and reports. Full saving uses the manual builder's
  `POST /api/simulations` API and transaction to insert the simulation, report
  copies, and scheduled links in PostgreSQL. AI saves include `ai_generated`,
  a custom `length_s`, synthetic reality 1, and integer-second offsets (including
  zero). The simulations API accepts bodies up to 10 MB. Report URLs are
  simulation-scoped, just like manual saves, so edited copies cannot collide
  with another simulation; source templates are never changed.
  Report copies and scheduled links are inserted in batches of up to 250 within
  the same transaction, avoiding two database round-trips per report. A floating
  saving indicator stays visible while scrolling, with a spinner in the final
  save button; duplicate saves remain disabled until completion.
  After success, return to the dashboard's regular saved simulations list.
  Manual and AI creation reuse the same save-success popup, including the
  simulation summary, dashboard action, and option to create another simulation.
  Saving creates a simulation, not an update to an existing saved simulation.
- Drafts still preserve reports, settings, and conversation under
  `cobra_ai_simulations_v1` in this browser's `localStorage`, like manual drafts.
  The separate local AI section can reopen or delete them (including older
  local-only saved simulations). A draft is removed locally after successful
  database saving. Chat, generation settings, and UI-only report-kind labels
  are draft metadata, not stored by the simulation API. Explicitly save drafts
  before leaving; clearing browser storage deletes them.
- Saving does not call AI or start a simulation execution run. The library
  picker reuses the manual builder's component and API helpers, loading all
  templates and categories from `/api/templates` and `/api/categories/tree`.
  The backend must be running to browse the library; failures are shown without
  falling back to demo reports. Adding a report copies its full payload and
  never modifies the library template.

### AI API configuration and protocol

Keep `kubectl -n fastbreak-preprod port-forward svc/cobra 8080:80` running.
Set `COBRA_API=http://127.0.0.1:8080` and `COBRA_API_TOKEN` in the backend's
git-ignored `.env`, then restart the backend after configuration changes.
Never put the token in a frontend/Vite environment variable.

- `POST /api/ai/generations` validates description/settings, submits a custom
  scenario to Cobra's `POST /runs`, and returns HTTP 202 with `runId` and status.
- `GET /api/ai/generations/:runId` proxies job status. The frontend polls every
  10 seconds, showing queued/running feedback, for up to 20 minutes. Leaving the
  workspace stops local polling; it does not cancel the upstream job (no cancel
  endpoint is documented). A new generation is not automatically retried.
  Generation uses the prototype's centered modal design with a dimmed backdrop,
  gold orbit, indeterminate progress bar, and stage checklist. The underlying
  workspace stays visible. Detailed model stages/percentages are not provided by
  the API, so the checklist does not simulate completion while the job runs.
- On completion, the backend downloads `reports.csv` and validates each report
  independently, even if provider quality checks failed (including the first-call
  90% threshold). Any nonempty valid subset is available for review and saving,
  even a single report. Quality failures and excluded-row details remain in the
  API response warnings; the UI banner only says the reports were created successfully.
- CSV conversion handles quoted commas, embedded newlines, UTF-8/BOM, booleans,
  dates, numeric coordinates and nullable counts. Empty casualty cells remain
  null; `"0"` becomes zero. Invalid rows are excluded with warnings, without
  changing valid reports or padding the result to the requested count. No valid
  reports, malformed CSV, invalid headers/job metadata, or more rows than requested
  still fail the import. Provider jobs with status `failed` remain errors.
  The obsolete upstream `matches` column is excluded from the report entity.
  The API does not supply reliable report-kind labels, so imported reports are
  marked unclassified rather than inventing original/false/duplicate labels.
- Provider errors, expired jobs/pod restarts, and unavailable port-forwards are
  surfaced without mock fallbacks. Results are held in the browser until explicitly
  saved; the upstream pod keeps only temporary in-memory results.

`frontend/src/types/aiSimulation.ts` separates DB-shaped simulation/report
fields from UI generation settings and report labels. The backend computes
`report_id` with `xxhash64` when saving; `client_id` is only a UI identity.
Reality isolation (`reality_id: 1`) and unknown-vs-zero casualty counts are
preserved. Old percentage-based local drafts can still be read without changing
their stored reports; they require review of the new noise/region/bounds settings
before regeneration. Mocks are used only by tests, not by the running builder.

Validation: `npm run test -w frontend -- --run`, `npm run test -w backend`,
`npm run build -w frontend`, and `npm run build -w backend`.

## Local Setup

1. Install dependencies from the repository root: `npm install`.
2. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL` to a PostgreSQL database you can access.
3. Set `DATABASE_URL` in the terminal environment and run `npm run migrate` from the repository root to create the schema.
4. Start the API and frontend with `npm run dev` from the repository root.

The API uses the PostgreSQL connection pool configured in `backend/src/db.ts`. The backend defaults to port `4000`; the Vite development proxy forwards `/api` requests to that port.
`GET /health` checks that the API process is running; `GET /health/ready` checks whether PostgreSQL is reachable and returns HTTP `503` when it is not. Database connection failures are reported in the backend logs without exposing credentials in the API response.
The backend runs from TypeScript with `tsx`; `npm run build -w backend` performs a type check without generating JavaScript files.

## Simulation API

- `GET /api/simulations` lists simulations with their linked reports and dispatch times.
- `GET /api/simulations/:id` returns one simulation and its events.
- `POST /api/simulations` creates a simulation with its selected reports transactionally.
- `DELETE /api/simulations/:id` deletes a simulation; simulations with existing runs are protected by the database constraint.

The backend follows a router → controller → service structure. Services own validation and database queries; controllers translate results to HTTP responses, and routers bind the HTTP methods and paths.

## Create a Simulation

`POST /api/simulations` creates a simulation and returns HTTP `201` with its database ID and creation time. The JSON request body is:

```json
{
	"title": "Example simulation",
	"description": "Optional scenario description",
	"difficulty": "בינוני",
	"events": [
		{
			"id": "event-1",
			"title": "Example report",
			"category": "התראה",
			"minute": 2,
			"description": "A synthetic report for the exercise."
		}
	]
}
```

Supported difficulty values are `קל`, `בינוני`, and `קשה`. They map to the database enum values `easy`, `medium`, and `hard`; their default durations are 20, 30, and 45 minutes. Events must be within the selected duration. New simulations use the `specter` target and simulated reality `1`. The API writes each event to `reports` and links it through `report_in_simulation` in the same transaction as the simulation insert; report IDs follow the documented `xxhash64` identity contract.
