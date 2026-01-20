-- Migration: Add overdue reminder tracking for bookings
-- This enables the 30-minute post-booking reminder feature

-- Add columns to track reminder state and action tokens
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS overdue_reminder_sent_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS action_token TEXT DEFAULT NULL;

-- Add index for efficient overdue booking queries
-- Only indexes active bookings that haven't received a reminder yet
CREATE INDEX IF NOT EXISTS idx_bookings_overdue_check 
ON bookings (end_time, status, overdue_reminder_sent_at) 
WHERE status IN ('in_progress', 'scheduled');

-- Add unique index on action_token for secure lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_action_token 
ON bookings (action_token) 
WHERE action_token IS NOT NULL;

COMMENT ON COLUMN bookings.overdue_reminder_sent_at IS 'Timestamp when the 30-min overdue reminder email was sent';
COMMENT ON COLUMN bookings.action_token IS 'Secure token for email action links (extend/release)';
