-- Add test_pins column to floors table
ALTER TABLE floors ADD COLUMN IF NOT EXISTS test_pins JSONB DEFAULT NULL;
