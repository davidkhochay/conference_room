-- Migration: Track deleted Google Calendar events to prevent re-syncing
-- This table stores google_event_ids that have been explicitly deleted by admins
-- so they won't be recreated during Google Calendar sync

CREATE TABLE IF NOT EXISTS deleted_google_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  google_event_id TEXT NOT NULL,
  google_calendar_id TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(google_event_id, google_calendar_id)
);

-- Index for fast lookups during sync
CREATE INDEX IF NOT EXISTS idx_deleted_google_events_lookup 
  ON deleted_google_events(google_event_id, google_calendar_id);

-- Auto-cleanup: remove entries older than 90 days (events older than this won't sync anyway)
-- Run this periodically via cron or manually
-- DELETE FROM deleted_google_events WHERE deleted_at < NOW() - INTERVAL '90 days';
