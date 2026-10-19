# Domain Glossary — COBRA Category & Library System

## Entities & Concepts

### 1. Template Category (`template_categories`)
- **Definition**: Top-level grouping entity for report templates in COBRA's content library (e.g., "Natural Disasters", "Hostile Terror", "Civil Unrest").
- **Boundaries**: Strictly a root container. Cannot have a parent category (depth = 1). Must have a unique name.
- **Relationships**: Has many `template_sub_categories` and `report_templates`.

### 2. Template Sub-Category (`template_sub_categories`)
- **Definition**: Second-level classification nested under a single `template_category` (e.g., "Wildfire", "Rocket Alert", "Mass Stabbing").
- **Boundaries**: Belongs exclusively to exactly one parent category. Name must be unique within its parent category.
- **Relationships**: Foreign key to `template_categories(id)`. Has many `report_templates`.

### 3. Report Template (`report_templates`)
- **Definition**: Pre-configured synthetic intelligence report template based on the DataForge `reports.enriched` schema.
- **Boundaries**: Stored in the library for scenario construction. Can be copied into `reports` during simulation setup. Belongs to a mandatory category and an optional sub-category.
- **Key Fields**: Must preserve casualty semantics (`NULL` = unknown, `0` = confirmed zero). Timestamps in plain UTC.

### 4. Category Fetcher
- **Definition**: The complete end-to-end category pipeline in COBRA responsible for both:
  1. Ingesting and synchronizing categories, sub-categories, and report links from static seed sources (CSV).
  2. Aggregating, counting, and serving the hierarchical category tree via backend Library APIs to the frontend browser.
- **Boundaries**: Does not dispatch reports to Kafka (that is the Scheduler's job). Does not violate `reality_id != 0`.

### 5. Library Browser
- **Definition**: The React frontend administrative interface for instructors to browse, search, inspect, and organize report templates across the category tree.
- **Interactions**: Tree navigation, card listing, report modal inspection, right-click context menu for editing/renaming/deleting categories and sub-categories.
