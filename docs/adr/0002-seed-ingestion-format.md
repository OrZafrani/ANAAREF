# ADR-0002: Seed Ingestion Format and Category Definition

## Status
Accepted

## Context & Problem Statement
In COBRA, `report_templates` requires a mandatory `category_id` (FK to `template_categories`) and an optional `sub_category_id` (FK to `template_sub_categories`). However, the generic simulation runner CSV (`enriched_reports_schema-v2.csv`) only contains raw report fields and `dispatch_offset_s`. We need a definitive format to ingest the ~20 Hebrew Specter library seed reports along with their category taxonomy.

## Options Considered
1. **Option A (Extend Library Seed CSV - Chosen)**: Add explicit `category` and `sub_category` string columns to the library seed CSV (`library_reports_seed.csv`). The seed loader parses these columns, ensures the referenced categories/sub-categories exist in the DB (creating them dynamically if absent), and links the templates accordingly.
2. **Option B (Separate Category Definition File)**: Maintain a standalone `categories.json` alongside the CSV. Reports in CSV reference category names or IDs.
3. **Option C (Algorithmic / Tag Derivation)**: Automatically infer categories from report content or NLP tags.

## Decision Outcome
Chosen option: **Option A**. The library seed CSV will explicitly contain `category` (required) and `sub_category` (optional) columns for each report template.

## Consequences & Trade-offs
- **Positive**: Self-contained seed dataset; easy for content creators and training officers to review and edit scenario reports and their categories in a single spreadsheet.
- **Negative / Risks**: The seed loader must ensure idempotent upserts for categories/sub-categories so that repeated category names across rows do not cause duplicate insertion errors or primary key collisions.
