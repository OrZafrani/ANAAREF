-- Allow a sub-category and its linked templates to move together in one transaction.

-- Up Migration

ALTER TABLE report_templates
    DROP CONSTRAINT report_templates_sub_category_fkey,
    ADD CONSTRAINT report_templates_sub_category_fkey
        FOREIGN KEY (category_id, sub_category_id)
        REFERENCES template_sub_categories (category_id, id)
        ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED;

-- Down Migration

ALTER TABLE report_templates
    DROP CONSTRAINT report_templates_sub_category_fkey,
    ADD CONSTRAINT report_templates_sub_category_fkey
        FOREIGN KEY (category_id, sub_category_id)
        REFERENCES template_sub_categories (category_id, id)
        ON DELETE RESTRICT;