# ANAAREF

## AI simulation builder (frontend demo)

Run `npm run dev -w frontend`, then choose the AI option under "New simulation",
or open `/simulations/ai`. The manual builder and real content library keep
their API-backed behavior.

The AI builder is a local, deterministic demonstration, **not an AI integration**:

- Describe a scenario in Hebrew, adjust settings, generate reports, edit/remove
  them, add copies from the demo library, and review before saving.
- Report review uses full-width cards with timing, kind, origin, urgency and
  casualty summaries. Each card's "פרטים" action opens a left-side drawer with
  a fixed header/footer, a two-column information grid, location information,
  expandable additional fields, and edit/remove actions. Missing location
  precision is explicitly marked rather than inferred.
- Drag report handles to reorder reports between the existing delivery-time
  slots; timestamps inside report payloads stay unchanged. Up/down buttons also
  support keyboard/touch reordering and moving across pages. Reordering is
  available with the "all" filter to avoid moving hidden reports unexpectedly.
  The new order and delivery offsets are included in local saves. Generated
  headlines do not include report sequence numbers.
- Chat recognizes simple difficulty words and durations such as `20 דקות`.
  It retains the conversation as report context; it does not perform real
  incident extraction, casualty inference, or language-model reasoning.
- Generation produces `round(duration_minutes * reports_per_minute)` reports.
  Duplicate, false, and background-noise counts are rounded down; the remaining
  reports are originals. Their combined percentage must be below 100.
- Generated timestamps are synthetic UTC values anchored to draft creation.
  Delivery times are stored separately as `dispatch_offset_s`.
- Save and save-as-draft are available in the header and final review step.
  Drafts can be saved before generating reports; full saving validates the
  settings and reports. Both persist reports, settings, and conversation under
  `cobra_ai_simulations_v1` in this browser's `localStorage`. The dashboard's
  separate AI section can reopen or delete them. Explicitly save drafts before
  leaving; clearing browser storage deletes them.
- No backend writes, AI requests, or simulation execution occur. Even the
  library picker receives local fixtures in this flow; the manual builder
  supplies API-backed library data to the same shared picker.

`frontend/src/lib/aiSimulation.ts` exposes the asynchronous mock chat,
generation, and library methods for replacement by the AI-team integration.
`frontend/src/types/aiSimulation.ts` separates DB-shaped simulation/report
fields from UI generation settings and report labels. Real `report_id` hashing
is intentionally deferred to the backend; `client_id` is only a UI identity.
Reality isolation (`reality_id: 1`) and unknown-vs-zero casualty counts are
preserved. Mock report payloads follow the current schema without the removed
`matches` field.

Validation: `npm run test -w frontend -- --run` and
`npm run build -w frontend`.

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
