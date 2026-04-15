-- Add image_url column to bug_report for screenshot uploads
ALTER TABLE bug_report ADD COLUMN IF NOT EXISTS image_url text;
