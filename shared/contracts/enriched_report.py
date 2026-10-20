# pip install pydantic==2.14.1
import json
from typing import List, Optional

import pydantic

class EnrichedReport(pydantic.BaseModel):
    # Identity
    report_id: int
    reality_id: int

    # Kept from RAW_REPORT
    schema_version: int
    is_official: bool
    platform: str
    account_name: str
    channel_name: str
    report_url: str
    media_type: List[str]
    report_title: Optional[str]
    original_language: str
    matches: List[str]
    categories: List[str]
    published_at: Optional[str]
    collected_at: str

    # Content
    original_content: str
    translated_content: str

    # Threat and location
    threat_level: int
    country: str
    city: str
    lat: float
    long: float
    happened_at: Optional[str]

    # Casualties
    red_injured_count: Optional[int]
    red_death_count: Optional[int]
    blue_injured_count: Optional[int]
    blue_death_count: Optional[int]

enriched_report: EnrichedReport = EnrichedReport(
    report_id=123456789,
    reality_id=0,
    schema_version=1,
    is_official=True,
    platform="X",
    account_name="example_account",
    channel_name="example_channel",
    report_url="https://example.com/report/123",
    media_type=["text", "photo"],
    report_title=None,
    original_language="en",
    matches=["keyword1", "keyword2"],
    categories=["security"],
    published_at="2026-10-19 10:00",
    collected_at="2026-10-19 11:00",
    original_content="Normalized original content",
    translated_content="תוכן מקורי מתורגם לעברית",
    threat_level=75,
    country="IL",
    city="Tel Aviv",
    lat=32.0853,
    long=34.7818,
    happened_at=None,
    red_injured_count=None,
    red_death_count=0,
    blue_injured_count=2,
    blue_death_count=1,
)



print(enriched_report)

print(json.dumps(EnrichedReport.model_json_schema()))

result: str = enriched_report.model_dump_json()
print(result)
