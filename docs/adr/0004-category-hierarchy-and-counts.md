# ADR-0004: Category Hierarchy, Ordering, and Count Semantics

## Status
Accepted

## Context & Problem Statement
The category browser in COBRA displays a category tree with count badges. We need to decide whether the hierarchy supports arbitrary recursive nesting or a fixed two-level hierarchy, how items are ordered, and how report counts are aggregated across parent and child nodes.

## Options Considered
1. **Option A (Fixed 2-Level Hierarchy, Alphabetical Sort, Aggregated Counts - Chosen)**:
   - Root categories (`template_categories`) and direct sub-categories (`template_sub_categories`).
   - Ordered alphabetically (Hebrew/English lexical sort).
   - Parent category count = count of all `report_templates` belonging to `category_id` (encompassing both reports without sub-category and reports assigned to its sub-categories).
   - Sub-category count = count of `report_templates` where `sub_category_id = sub_cat.id`.
2. **Option B (Fixed 2-Level with Manual `sort_order` Column)**: Adding a manual sorting integer column to allow drag-and-drop reordering.
3. **Option C (Arbitrary N-Level Nested Tree)**: A single `categories` table with a nullable `parent_id` foreign key.

## Decision Outcome
Chosen option: **Option A**. Follows the authoritative COBRA.md relational schema (`template_categories` and `template_sub_categories`), avoiding schema churn. Ordering is alphabetical, and counts roll up cleanly from sub-categories to their parent.

## Consequences & Trade-offs
- **Positive**: Directly aligns with COBRA.md schema without table structural changes; clear, predictable count aggregation; simple SQL `COUNT(*)` queries with `GROUP BY`.
- **Negative / Risks**: Deeply nested trees (> 2 levels) are not supported, which is consistent with the current product requirements.
