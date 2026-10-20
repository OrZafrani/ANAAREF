# COMBAT Simulation Experience Plan

## Mission and scope

COBRA currently builds and runs SPECTER simulations by scheduling synthetic reports for delivery to `reports.enriched`. COMBAT simulations should exercise the next operational stage: trainees receive operational events and manage triage, status, threat assessment, force tracking, and response in the downstream COMBAT application.

This plan covers COBRA’s COMBAT simulation authoring, persistence, review, run management, and publication of simulated EVENT messages. COBRA is not the COMBAT operational application: its operational event screens, workflows, alerts, and downstream storage remain the responsibility of that system. The plan does not assume COMBAT exposes a REST API or any interface beyond consuming the supplied Kafka contract.

**Intended users:** COBRA training officers author and launch scenarios; COMBAT operators (מנל"חים / מנהלי לחימה) participate in exercises in the operational application; COMBAT technical and Data Engineering owners support integration and contract validation.

**Goals**

- Allow training officers to create, edit, review, launch, stop, and inspect runs of COMBAT event simulations.
- Author ordered operational event scenarios and set each event’s offset from run start.
- Publish EVENT payloads that conform to the current contract on `events.state`, with simulated reality isolation.
- Preserve the existing SPECTER authoring and dispatch path.

**Non-goals**

- Implement or change the downstream COMBAT application, its operational screens, or its alerting and response behavior.
- Add speculative event fields, Kafka topics, REST endpoints, or contract/schema changes.
- Add trainee scoring, AI scenario generation, CSV event import, or multi-reality administration in the first implementation unless separately approved.

**Assumptions and known unknowns**

- The supplied EVENT contract is authoritative. `C:\Users\Lenovo\Downloads\schemas.html` is a local contract reference, not a versioned repository artifact; confirm its continued currency with the schema owner before implementation.
- The current SPECTER path uses simulated `reality_id = 1`. Reuse for COMBAT is a candidate default, not a confirmed COMBAT decision. COBRA must never publish `reality_id = 0`.
- Current event scenario editing is not implemented as a saved-simulation update flow. Editing behavior and immutability after a run begins need product confirmation.
- No event-level persistence model, COMBAT event producer, consumer interface, or end-to-end COMBAT test environment was found in the inspected repository.

## Current-state findings

These are repository observations, distinct from the recommendations below.

| Area | Verified behavior |
|---|---|
| Target selection | `frontend/src/lib/appSettings.tsx` defines SPECTER and `cm` (shown as `ניהול לחימה`); `frontend/src/components/GlobalNavbar.tsx` renders the selector. Backend persistence maps `cm` to database target `combat`. |
| Simulation authoring | `frontend/src/pages/CreateSimulation.tsx` collects simulation details; `frontend/src/pages/SelectEvents.tsx` builds the scenario from the report-template library and submits it. The submitted event shape is title, category, minute, and description. |
| Persistence | `backend/src/services/simulations.service.ts` stores simulations and represents each authored event as a row in `reports`, linked through `report_in_simulation`. The service maps `cm` to `combat`, assigns reality 1, and validates inputs using SPECTER-oriented fields. There is no separate EVENT scenario model. |
| Database | `backend/migrations/0001_create_schema.sql` defines `simulation_target_system` with `specter` and `combat` and seeds realities 0 and 1. `backend/migrations/0004_create_simulations.sql` stores a target and nonzero reality on simulations; its scheduled inject table is report-specific. |
| Scheduler and Kafka | `backend/src/scheduler/index.ts` explicitly rejects non-SPECTER simulations. `backend/src/scheduler/runRepository.ts`, `runExecutor.ts`, and `types.ts` operate on report rows and report cursors. `backend/src/kafka.ts` publishes only to the configured reports topic. |
| Runs | `backend/src/routes/runRoutes.ts` provides run start, stop, status, and history routes; the existing run model has a single-started-run constraint and persisted dispatch progress. The home page displays simulation and run summaries. |
| UI states and patterns | The builder and home page use Hebrew RTL labels, a system selector, theme-aware shared styling, library loading/error states, and run status/history. The current builder has no COMBAT-specific event form, saved-simulation edit flow, or review screen tailored to EVENT fields. |
| Tests/docs | Scheduler and simulation service tests include a case confirming COMBAT runs are rejected. `COBRA.md` documents a planned post-MVP COMBAT flow, but parts of its EVENT contract are stale relative to the current supplied contract. |

### Contract discrepancies to resolve in documentation and implementation

Use the current contract below as authoritative; do not copy the older table in `COBRA.md` into new code. Update or annotate that documentation as part of implementation planning/review so engineers do not use the stale definitions.

- `categories` is `string[]` and replaces `event_type` (`string`). The old document’s “tactical categorization” and single `event_type` field are not the current wire contract.
- Current `description`, `notes`, `sector`, `sector_description`, `threat_level`, and `deployed_forces` are fields with stated types; the old document marks some nullable or optional. Follow the current contract’s type and nullability, not those old nullable claims.
- Current `threat_level` is an integer bounded 0–100, not a generic number. `deployed_forces` is an integer, not a generic number; the contract gives no explicit lower or upper bound.
- Casualty/injury counts use `red_injured_count`, `red_death_count`, `blue_injured_count`, and `blue_death_count`. The old document has the names but does not fully reflect the current type/nullability contract in all details.
- Current `status` is a string enum (`open`, `in_progress`, `closed`) and current EVENT versioning requires consumers to accept only higher versions. Do not assume the old “Avro enum” or Schema Registry wording: the local schema reference says messages are JSON, with no Schema Registry, and schemas are validated in producer/consumer code.
- The local reference identifies Specter + COMBAT as EVENT schema owners and COBRA as producer for simulated events; the old `COBRA.md` says “Shared Outbox Relay / Schema Registry.” Confirm ownership directly with Data Engineering and the COMBAT/Specter contract owners.
- Current topic is compacted `events.state`; key is exactly `{reality_id}:{event_id}`. `COBRA.md`’s sample sequence agrees on topic and key, but its field table is outdated.

## User workflows and UX direction

Reuse the current builder shell, Hebrew RTL layout, shared theme, and home-page run monitoring. Keep SPECTER’s report authoring path intact. COMBAT needs a distinct event authoring model and controls because a COMBAT event is already an operational incident, not a report to be clustered.

### Training officer workflow

1. Select `ניהול לחימה` in the global target-system selector and choose create simulation.
2. Enter simulation name, description/context, difficulty or duration, then add events from the COMBAT event scenario library and/or create events manually. Library reuse is conditional on providing a COMBAT-specific event catalog; the existing report-template library is not automatically a source of valid EVENT records.
3. Set event order and each event’s dispatch offset (`T+` time from simulation start). Offsets must be non-negative and within the simulation duration. Allow events to share an offset; dispatch them deterministically using a persisted secondary order, whose exact identity/order rule must be selected during implementation and tested.
4. Review an event timeline and full payload-oriented summary, including categories, starting status, assessment counts, threat level, deployed forces, event times, and reality. Show unknown counts distinctly from reported zero.
5. Launch only after server-side validation succeeds. During execution, show run status, elapsed time, dispatched/remaining events, upcoming offsets, and failures using the existing run dashboard patterns.
6. Inspect prior runs and their final status, dispatch progress, and failure reason. Stop an active run through the existing run-control pattern.

### Suggested information architecture

```text
Home (filtered by target system)
  └─ Create simulation
       ├─ 1. Details and duration
       ├─ 2. Operational event timeline
       │    ├─ Add from COMBAT event library (if supplied)
       │    └─ Create/edit event and set T+ dispatch time
       └─ 3. Review and save
Home / simulation drawer
  ├─ Review details and event timeline
  ├─ Launch run
  └─ Run history / active-run status / stop
Downstream COMBAT application (external)
  └─ Consume events.state and display/manage events by reality_id
```

### UI states and accessibility

- Show distinct loading, empty-catalog, catalog-load-error, save-error, validation-error, launch-error, and run-history-error states. Retain draft work after recoverable errors using the established draft pattern or a server-backed draft, with the persistence choice made during implementation.
- Empty simulation must not be launchable. Identify missing required event fields beside the affected event and in the review summary.
- Preserve keyboard access, visible focus, semantic labels, RTL reading order, theme support, and correct numeric/time directionality for offsets and casualty counts.
- Use precise Hebrew labels approved by COMBAT operators for event status, threat, sector, casualties, and forces. Do not translate or invent operational terminology before that review.

## Event contract and data handling

The following table maps every field in the supplied current EVENT contract to authoring/persistence and publication. “Persist per event” is a design recommendation; exact database structure should follow the existing migration and transaction patterns without expanding the Kafka contract.

| EVENT field | Type / contract | Authoring and persistence recommendation |
|---|---|---|
| `event_id` | string; part of composite identity | Generate a stable event identifier before run launch and persist it with the scenario event. Confirm required format, scope, and whether an event keeps the same ID across repeated runs. Do not assume `COBRA.md`’s UUID statement until the contract owner confirms it. |
| `reality_id` | int; 0 real, nonzero simulated | Resolve per simulation/run from an approved simulation reality. Persist the chosen ID and enforce nonzero in API validation and database constraints. Confirm whether COMBAT uses seeded reality 1 or needs a separate allocated reality. |
| `version` | int; +1 on every change; consumer upserts only higher | Initial publish uses the contract-approved first version; every subsequent emitted state change increments it by one. Confirm initial value and whether COBRA publishes only an initial state or also later revisions. |
| `status` | string: `open`, `in_progress`, `closed` | Author initial event status; default to `open` only after product/COMBAT confirmation. Do not model trainee status transitions as COBRA mutations unless a supported feedback path is explicitly agreed. |
| `categories` | string[]; free text; replaces `event_type` | Store and edit a list of category strings. Confirm operator vocabulary and whether an empty list is valid; do not use the old single `event_type` field. |
| `is_deleted` | boolean; logical delete, default false; never hard-delete | Persist and publish `false` for active authored events. If deletion after an event has been published is supported, emit an incremented version with `true`; do not publish a Kafka tombstone or hard-delete the downstream event. Confirm whether deletion is needed for v1. |
| `title` | string | Required event headline, editable in the builder. |
| `description` | string | Required per the current table’s type; capture event narrative. Confirm whether empty text is permitted by the actual JSON Schema. |
| `notes` | string | Capture notes according to the current non-null contract. Confirm whether operators should start with empty string or authored notes. |
| `sector` | string | Capture the sector label; vocabulary and empty-value behavior require COMBAT input. |
| `sector_description` | string | Capture sector details; confirm whether it can be empty and how it appears downstream. |
| `start_time` | datetime UTC | Distinguish the operational event start time from simulation dispatch offset. Confirm whether to author an absolute scenario time or derive from run start plus a configured event-relative offset. Publish ISO 8601 UTC. |
| `red_injured_count` | int or null | Nullable integer editor with explicit “unknown” state. Preserve null as JSON `null`; preserve reported zero as `0`. |
| `red_death_count` | int or null | Same null-versus-zero handling. |
| `blue_injured_count` | int or null | Same null-versus-zero handling. |
| `blue_death_count` | int or null | Same null-versus-zero handling. |
| `threat_level` | int, 0–100 | Require integer in inclusive range 0–100 in UI and API. Confirm whether 0 is meaningful and what Hebrew labels describe the scale. |
| `deployed_forces` | int | Require an integer. Contract supplies no explicit range; obtain minimum/maximum and meaning from COMBAT before choosing any bounds. |
| `created_at` | datetime UTC | Set when the event is first created in COBRA; persist and emit UTC. Confirm whether this means scenario authoring time or first downstream publication time. |
| `updated_at` | datetime UTC; latest version time | Set to the time corresponding to the emitted version and persist in UTC. Confirm timestamp precision and whether simulated event time affects this field (recommended: it does not; this is update/audit time). |

### Dispatch, identity, reality, and consumer assumptions

- Publish JSON to compacted topic `events.state`, keyed exactly as the string `{reality_id}:{event_id}`. Configure the topic name through backend configuration following the existing Kafka settings pattern, but do not invent a new public API endpoint.
- A dispatch offset is COBRA scheduling metadata, not an EVENT contract field. Resolve `dispatch_at = run.started_at + dispatch_offset_s` in the scheduler and do not serialize the offset unless a separately approved contract adds it.
- Reuse the repository’s current UTC timestamp convention (`timestamp` columns holding UTC and explicit UTC conversion) consistently. The exact `start_time` semantics and precision require owner confirmation.
- Keep all database and producer paths guarded against `reality_id = 0`. The current service and report producer use reality 1; the COMBAT path should support reality 1 only if COMBAT confirms it is the intended shared training partition. Do not imply isolation per exercise if multiple simulations share one reality; event IDs and COMBAT filters must prevent collisions and exposure to live reality.
- Consumer behavior to verify with COMBAT: partition and view by `reality_id`; upsert only when `version` is higher; treat `is_deleted=true` as logical deletion; accept keys and JSON payload exactly as contracted; keep simulated events out of live operational alerting and response actions.
- Preserve the distinction between event `start_time` and message creation/update timestamps. Do not synthesize casualty zeros for unknown values or coerce `NULL` during UI, database, or JSON serialization.
- Do not add `EVENT_REPORTS` publication or links in this feature: no event-report relationship is required by the supplied COBRA EVENT scenario request, and the event contract says no extra fields.

## Technical approach

The recommendations below follow existing repository patterns but require validation against COMBAT and Data Engineering inputs before implementation.

### Frontend

- Keep the shared home and target selector; ensure `ניהול לחימה` filters to COMBAT simulations and the create route captures the selected target in submitted data rather than relying only on local selector state.
- Add a COMBAT-specific authoring branch and form model. Reuse builder header, layout, buttons, theme tokens, and run status components where possible. Keep existing SPECTER event selection and serialization unchanged.
- Add event editing controls for contract fields, an ordered timeline with dispatch offsets, and a review step that displays every outgoing field and clearly labels unknown counts.
- Add edit and read-only views for saved simulations. Define whether editing is allowed after any run exists; while a run is active, lock the scenario, following the existing report-in-simulation change guard pattern.

### Backend, persistence, and API

- Add an event scenario persistence model through additive migrations. Prefer an event table and simulation-to-event schedule relation (or an equivalent normalized design) that stores contract fields separately from existing `reports` and `report_in_simulation`. Include nonzero reality enforcement and dispatch-offset validation. Avoid storing EVENT payloads in report columns.
- Extend simulation create/read/edit service logic with explicit target-specific validation and transactions. Preserve existing SPECTER payload contracts and report identity rules.
- Use the existing simulations and runs route families and response/error patterns. Define request/response shapes from actual frontend needs during implementation; this plan does not prescribe or claim new endpoint paths because none are established by the repository or external contract.
- Ensure edits are rejected while a simulation has a started run, and decide whether completed-run simulations can be edited or must be cloned. Keep run history associated with the exact scenario state that was dispatched, either by locking post-run edits or by versioning/snapshotting; resolve this before implementation.

### Scheduler and Kafka

- Generalize scheduler dispatch by target while keeping a separate event serializer and publisher path. Continue report dispatch for SPECTER; route COMBAT events only to `events.state`.
- Add event dispatch repository types and a progress cursor with stable deterministic ordering by `(dispatch_offset_s, event_id)` or another owner-approved stable key. Persist progress so recovery after restart does not skip events. Clarify at-least-once replay semantics: existing report scheduler notes possible duplicate messages after uncertain acknowledgement; the COMBAT consumer must be version/idempotency safe.
- Validate the complete event payload before creating a run. Publish only after the run starts and the configured offset is due. Surface Kafka failures using existing `failed` run status and `failure_reason` conventions.
- Confirm producer authorization, broker topic ACLs, compaction/retention configuration, and availability of a safe test topic/consumer with infrastructure owners. Do not publish to a live operational environment for initial integration validation.

### Permissions and safety

- Reuse current authentication/authorization architecture where present; the inspected runtime currently has no COMBAT-specific role enforcement established by this plan. Confirm whether only training officers may edit or start simulations and who may read history.
- Enforce `reality_id != 0` at validation, persistence, and serialization boundaries. Do not rely on UI hiding alone. Confirm downstream COMBAT isolation in a controlled integration environment before operational use.

## What to get from ניהול לחימה and data owners

Obtain these inputs before locking schemas, UX details, or production integration:

### From COMBAT operational users (מנל"חים / מנהלי לחימה)

- A named operational contact and representative trainees for short workflow reviews.
- The real triage sequence: which event fields operators inspect or change, what “response” means in this exercise, and which trainee actions must be simulated versus performed in COMBAT.
- Approved Hebrew names/help text for status, categories, sectors, threat levels, deployed forces, and red/blue casualties.
- Example scenarios and representative values for sector, event categories, status, threat, casualty/injury counts, and force counts, including unknown versus zero examples.
- Which fields should be visible or emphasized in the pre-launch review and what counts as a plausible exercise timeline.

### From COMBAT technical / consumer owners

- Named technical owner and confirmation that a consumer subscribes to `events.state` and supports nonzero realities.
- Consumer behavior for reality partitioning, compacted key, JSON validation, version-gated upserts, `is_deleted`, and duplicate/replayed messages.
- Whether event IDs need a specific format or uniqueness scope, whether IDs persist across repeated runs, initial `version`, and any event update/cleanup expectations.
- Meaning of `start_time`, required UTC precision, handling of empty strings/arrays, allowed category values, and behavior for each non-null string field.
- Whether COMBAT simulation should use reality 1 or another nonzero reality, who allocates it, and whether each exercise needs a separate reality.
- How to observe successful receipt in a non-production test environment, including sample consumer logs/UI and an end-to-end test window.

### From Data Engineering / schema owners and platform staff

- Named Data Engineering/schema contact confirming the exact current JSON Schema and ownership, including the four nullable count fields, `threat_level` bounds, `deployed_forces` range, and required/nullable string fields.
- Confirmation that `events.state` is provisioned as compacted, the expected key encoding is literal `{reality_id}:{event_id}`, and the producer identity has the required ACLs.
- Kafka delivery/retention/partition expectations and recommended safe test environment.
- Agreement on schema-versioning/review process and how COBRA validates against the contract in CI/runtime (the supplied reference states there is no Schema Registry).

Keep a decision log for each answer, its owner, and the date verified; unresolved items that affect payload validity or reality isolation block production dispatch.

## Phased implementation plan

1. **Contract and workflow confirmation** — Get the named owners and decisions above; validate the supplied schema reference; agree on first-run reality, event identity/version behavior, initial status, event time semantics, and operator vocabulary. Outcome: signed-off v1 field semantics and workflow notes.
2. **Domain and persistence foundation** — Add target-specific event types, additive migrations, validation, persistence, and create/read/edit service behavior. Add locking or snapshot rules for run immutability. Outcome: COMBAT simulations can be saved and reviewed without touching SPECTER report storage.
3. **Authoring and review UX** — Implement the COMBAT event builder, catalog/manual authoring source agreed in phase 1, ordered timeline, dispatch offsets, payload preview, and accessible Hebrew RTL validation states. Outcome: training officer can author and validate a complete event scenario.
4. **Dispatch and run management** — Add EVENT serialization, `events.state` producer, COMBAT scheduler dispatch, durable cursor/recovery, run progress, stop/failure handling, and target-specific run UI. Outcome: safe simulated event run in a controlled environment.
5. **Integration hardening and release readiness** — Validate consumer behavior, reality isolation, replay/idempotency, monitoring/logging, operator runbook, and rollout controls with COMBAT/Data Engineering. Outcome: accepted end-to-end exercise in a non-production COMBAT environment.

## Validation plan for future implementation

Do not run tests as part of this planning document task. During implementation, add coverage for:

- Contract serialization: required field/type checks, exact topic/key, UTC timestamps, initial status/version, category array, logical delete, and rejection of any `reality_id = 0`.
- Count semantics: round-trip `null` and `0` independently for all four casualty/injury fields through API validation, persistence, preview, and Kafka JSON.
- Numeric validation: threat levels `0` and `100` accepted; values below/above rejected; fractional values rejected; deployed-force fractional and agreed out-of-range values rejected.
- Simulation service and migration behavior: SPECTER create/read/run remains unchanged; COMBAT events save/read/edit; invalid target-specific fields fail atomically; active-run edits are blocked; history remains tied to dispatched event data.
- Scheduler: order by offset, deterministic ties, offset zero, events at duration boundary, restart recovery, stop, no-event run rejection, broker failure, duplicate/replayed publish handling, and completion after last event.
- UI: RTL/theme, event create/edit, unknown versus zero, empty/loading/error/validation states, review accuracy, filtering by target, and run history/progress.
- Integration: a safe COMBAT consumer receives the exact compacted key and payload; applies only higher versions; partitions simulated events; handles logical deletion; and cannot surface a simulation in a live-reality view or trigger real operational response.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Stale `COBRA.md` contract guidance leads to incompatible messages | Annotate/update the stale contract section during implementation; make current schema ownership and source explicit; add serialization contract tests. |
| Reusing reality 1 causes event collisions or cross-exercise visibility | Obtain COMBAT partition/ID scope decision; enforce unique IDs in agreed scope; use a dedicated nonzero reality if required and supported. Never use zero. |
| Existing report-based data model leaks into COMBAT | Use a separate event model, serializer, and dispatch path; regression-test SPECTER. |
| Unknown `start_time`, empty-string, or range semantics create invalid events | Confirm with COMBAT and Data Engineering before form/schema finalization; validate server-side. |
| Scheduler restart or uncertain Kafka acknowledgement replays events | Persist dispatch cursor; use stable key/version; validate consumer upsert idempotency in integration. |
| Training data reaches live COMBAT workflows | Test downstream reality filters and alert suppression in a controlled environment before any operational launch. |

## Acceptance criteria

- A training officer can create, edit under the agreed locking/version policy, review, save, and launch a COMBAT simulation composed of operational EVENT scenarios with ordered dispatch offsets.
- COMBAT runs produce only contract-compliant JSON on `events.state` with the exact `{reality_id}:{event_id}` key and never publish `reality_id = 0`.
- All EVENT fields follow the current contract; versions increase on every emitted change; deletions use `is_deleted`; all timestamps are UTC; counts preserve `null` versus `0`; threat level is an integer from 0 through 100; deployed forces are integral and follow owner-approved bounds.
- Scheduler progress, recovery, completion, stop, failure, and run history work for COMBAT without changing the SPECTER report flow.
- The COMBAT consumer demonstrably partitions simulated data from reality 0 and upserts only higher versions in an approved non-production end-to-end exercise.
- Hebrew RTL, keyboard access, theme behavior, validation, and empty/loading/error states meet the approved operator and training-officer workflow.
- All contract and consumer questions that affect payload validity, identity, and reality isolation have named owners and recorded decisions.
