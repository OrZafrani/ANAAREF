"""Writes enriched_report.schema.json from the DE team's enriched_report.py.

Run from any folder, with the Pydantic version enriched_report.py pins:
    python3 shared/contracts/generate_schema.py
"""
import contextlib
import io
import json
import pathlib
import runpy

here = pathlib.Path(__file__).parent

# enriched_report.py prints an example when it runs; keep that out of the output.
with contextlib.redirect_stdout(io.StringIO()):
    model = runpy.run_path(str(here / "enriched_report.py"))["EnrichedReport"]

schema = json.dumps(model.model_json_schema(), indent=2, ensure_ascii=False)
(here / "enriched_report.schema.json").write_text(schema + "\n", encoding="utf-8")
print("Wrote", here / "enriched_report.schema.json")
