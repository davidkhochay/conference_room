-- Migration: Add recurring booking support
-- Adds fields to track recurring meetings and their occurrences

-- Add recurrence fields to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_rule JSONB,
ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS recurring_parent_id UUID REFERENCES bookings(id) ON DELETE CASCADE;

-- Index for efficient querying of recurring series
CREATE INDEX IF NOT EXISTS idx_bookings_recurring_parent ON bookings(recurring_parent_id);

-- Index for finding recurring bookings
CREATE INDEX IF NOT EXISTS idx_bookings_is_recurring ON bookings(is_recurring) WHERE is_recurring = true;

-- Comment on the recurrence_rule structure:
-- {
--   "type": "weekly" | "monthly",
--   "daysOfWeek": [0-6],  -- For weekly: 0=Sunday, 1=Monday, etc.
--   "dayOfMonth": 1-31   -- For monthly: which day of the month
-- }

COMMENT ON COLUMN bookings.is_recurring IS 'True for parent recurring bookings';
COMMENT ON COLUMN bookings.recurrence_rule IS 'JSON object with type (weekly/monthly), daysOfWeek for weekly, dayOfMonth for monthly';
COMMENT ON COLUMN bookings.recurrence_end_date IS 'When the recurring series ends';
COMMENT ON COLUMN bookings.recurring_parent_id IS 'Links occurrence to parent recurring booking';

