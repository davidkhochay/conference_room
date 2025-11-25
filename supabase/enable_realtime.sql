-- Enable Realtime for bookings table so all clients get instant updates
-- Run this in your Supabase SQL editor

-- Enable Realtime replication for the bookings table
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;

-- Verify it was added (optional - just for checking)
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

