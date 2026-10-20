# Contracts

Data contracts owned by other teams. Don't edit these files by hand: replace them when the owner sends a new version.

| File | Owner | What it is |
|---|---|---|
| `enriched_report.py` | DE team | `ENRICHED_REPORT`, the message on `reports.enriched`, as a Pydantic model |
| `enriched_report.schema.json` | generated | JSON Schema of that model, used by `backend/src/scheduler/reportMessage.contract.test.ts` |

## Updating `ENRICHED_REPORT`

1. Replace `enriched_report.py` with the new file from DE.
2. Regenerate the schema (needs Python with the Pydantic version the file pins):

   ```bash
   python3 shared/contracts/generate_schema.py
   ```

3. Run `npm test -w backend`. The contract test lists every field our messages no longer match.
4. Update `backend/src/scheduler/reportMessage.ts` (and the database, if new data is needed) until it passes.
