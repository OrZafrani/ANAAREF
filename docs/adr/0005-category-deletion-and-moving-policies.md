# ADR-0005: Deletion and Moving Policies for Categories and Sub-Categories

## Status
Accepted

## Context & Problem Statement
In COBRA, `report_templates` has foreign keys to `template_categories(id)` (mandatory) and `template_sub_categories(id)` (optional). When instructors interact with the category tree via the right-click context menu, they may attempt to delete or move categories or sub-categories that contain existing report templates. We need a safe, unambiguous deletion and relocation policy.

## Options Considered
1. **Option A (Restrictive Deletion & Transactional Sub-Category Relocation - Chosen)**:
   - Block deletion of any category that contains sub-categories or reports. Return HTTP 409 Conflict with descriptive message ("Cannot delete category containing X items. Please remove or reassign reports first").
   - Block deletion of any sub-category that contains reports.
   - For moving a sub-category to a new parent category: In a single database transaction, update `template_sub_categories.category_id = :new_parent_id`, and update all `report_templates` with `sub_category_id = :id` to set `category_id = :new_parent_id`.
2. **Option B (Permissive Deletion / Unassigned Fallback)**: Automatically nullify sub-categories and reassign orphaned parent reports to a default "General / Unassigned" category.
3. **Option C (Cascade Delete)**: Deleting a category deletes all templates under it.

## Decision Outcome
Chosen option: **Option A**. Restrictive deletion prevents accidental loss of operational training scenario reports. Transactional sub-category relocation guarantees that referential integrity and the composite hierarchy invariant `(category_id, sub_category_id)` remain strictly consistent.

## Consequences & Trade-offs
- **Positive**: Zero risk of unintentional report data destruction or orphaned references; preserves data integrity.
- **Negative / Risks**: Instructors must explicitly empty a category before deleting it.
