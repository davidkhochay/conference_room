-- Store attendee response status from Google Calendar
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS attendee_response_statuses JSONB DEFAULT '{}'::jsonb;
