-- Run this once against existing MySQL databases before tightening the columns.
UPDATE user_feedback SET status = 'PENDING' WHERE status IS NULL OR TRIM(status) = '';
UPDATE user_feedback SET category = 'GENERAL' WHERE category IS NULL OR TRIM(category) = '';

-- Optional hardening after the application and backfill have both been deployed.
ALTER TABLE user_feedback MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'PENDING';
ALTER TABLE user_feedback MODIFY COLUMN category VARCHAR(30) NOT NULL DEFAULT 'GENERAL';
