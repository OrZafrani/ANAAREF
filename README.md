# ANAAREF

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