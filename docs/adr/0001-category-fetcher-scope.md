# ADR-0001: Category Fetcher Scope and Architectural Boundaries

## Status
Accepted

## Context & Problem Statement
In COBRA, the category and library management sub-system requires loading seed scenario templates (~20 Hebrew Specter reports), organizing them hierarchically (categories and sub-categories), and exposing this structure to both the backend Library API and the frontend catalog browser. We need to clearly define the boundary and scope of the "Category Fetcher" component to prevent architectural ambiguity between ingestion, data storage, and API querying.

## Options Considered
1. **Option A (Ingestion-Only Fetcher)**: A one-off script or CLI command that only extracts categories and sub-categories from CSV and inserts them into PostgreSQL. API querying and tree aggregation left to ad-hoc controllers.
2. **Option B (Query-Only Fetcher)**: A backend service layer only responsible for retrieving the tree and computing counts from the database for API endpoints.
3. **Option C (Complete End-to-End Category Pipeline - Chosen)**: A unified category module that encapsulates both the seed ingestion/sync pipeline (parsing CSV, upserting categories/sub-categories, linking reports) and the high-performance query service (tree hierarchy assembly, dynamic report counts aggregation, filtering support).

## Decision Outcome
Chosen option: **Option C**. The Category Fetcher is defined as the end-to-end category pipeline responsible for:
1. Ingestion / Sync: Extracting, validating, and upserting categories, sub-categories, and report associations from seed sources (CSV) into PostgreSQL.
2. Query / Aggregation: Fetching and aggregating the hierarchical tree with live report counts for the Library API.

## Consequences & Trade-offs
- **Positive**: Clean encapsulation of category domain logic; single source of truth for category structure and counts across both seed ingestion and REST API endpoints.
- **Negative / Risks**: Needs clear internal separation between the ingestion/write path and the query/read path so that heavy re-indexing or seeding does not block API requests.
