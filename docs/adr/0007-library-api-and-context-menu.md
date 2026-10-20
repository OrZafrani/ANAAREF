# ADR-0007: Library API Contract and Frontend Context Menu Interactions

## Status
Accepted

## Context & Problem Statement
The COBRA content catalog requires a responsive, robust API interface and an intuitive Hebrew-oriented right-click context menu in the React frontend for managing and navigating categories, sub-categories, and scenario report templates.

## API Specification
1. **Category Tree & Hierarchy**:
   - `GET /api/categories/tree`: Returns the complete two-level tree with real-time aggregate report counts.
     ```json
     [
       {
         "id": "uuid",
         "name": "פח\"ע וטרור",
         "report_count": 8,
         "sub_categories": [
           {
             "id": "uuid",
             "name": "ירי רקטי",
             "report_count": 5
           },
           {
             "id": "uuid",
             "name": "פיגוע דקירה",
             "report_count": 3
           }
         ]
       }
     ]
     ```
2. **Category Management (CRUD)**:
   - `POST /api/categories`: `{ "name": string }` -> `201 Created`
   - `PATCH /api/categories/:id`: `{ "name": string }` -> `200 OK`
   - `DELETE /api/categories/:id`: Returns `204 No Content` or `409 Conflict` if containing items.
   - `POST /api/categories/:category_id/sub-categories`: `{ "name": string }` -> `201 Created`
   - `PATCH /api/sub-categories/:id`: `{ "name"?: string, "category_id"?: string }` -> `200 OK` (supports rename & atomic move)
   - `DELETE /api/sub-categories/:id`: Returns `204 No Content` or `409 Conflict` if containing reports.
3. **Report Template Browsing**:
   - `GET /api/library/reports?category_id=&sub_category_id=&search=`: Returns array of report template cards.
   - `GET /api/library/reports/:id`: Returns full report template entity for modal inspection.

## Frontend Right-Click Context Menu Specification
- **On Root Category**:
  - `הוסף תת-קטגוריה` (Add Sub-Category) -> Opens inline input or modal
  - `שנה שם` (Rename) -> Inline rename field
  - `מחק קטגוריה` (Delete) -> Confirmation dialog (disabled if items > 0)
- **On Sub-Category**:
  - `שנה שם` (Rename)
  - `העבר לקטגוריה...` (Move to Category) -> Category selector dropdown dialog
  - `מחק תת-קטגוריה` (Delete) -> Confirmation dialog (disabled if items > 0)
- **On Tree Empty Area**:
  - `הוסף קטגוריה חדשה` (Add Root Category)

## Consequences & Trade-offs
- **Positive**: Clean REST semantics, comprehensive coverage of user operations, and seamless desktop-grade UX in the browser.
- **Negative / Risks**: Must prevent browser default context menu from conflicting (`e.preventDefault()`) and close the custom context menu upon outside click.
