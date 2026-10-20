# Contracts

Data contracts owned by other teams. Don't edit these files by hand: replace them when the owner sends a new version.

| File | Owner | What it is |
|---|---|---|
| `specter_enriched_report.example.json` | Specter team | Example `ENRICHED_REPORT` message on `reports.enriched`. **This is the format Cobra follows.** |
| `enriched_report.py` | DE team | Their `ENRICHED_REPORT` as a Pydantic model. Kept for reference only; Cobra doesn't follow it where it differs from Specter's example. |

`backend/src/scheduler/reportMessage.contract.test.ts` checks every message Cobra sends against Specter's example: the same fields in the same order, the same JSON type for each field (a null on either side is accepted, since an example can't show which fields may be null), and the same timestamp format.

## Where DE's model and Specter's example disagree

Cobra follows Specter's example on all of these:

| Field | DE's model | Specter's example (what Cobra sends) |
|---|---|---|
| `report_id` | integer | string |
| `media_type` | required | not sent |
| `translated_content` | required string | `null` when the report is already in the target language |
| `fastbreak_model_version` | not in the model | sent |
| Timestamps | `"2026-10-19 10:00"` in DE's example | ISO 8601 UTC, `"2026-10-19T14:58:00.000Z"` |

## Updating

When Specter sends a new example, replace `specter_enriched_report.example.json` and run `npm test -w backend`. The contract test lists every field our messages no longer match. Then update `backend/src/scheduler/reportMessage.ts` until it passes.
