-- Good Life Group - Test Data Seed
-- Run this in Supabase SQL Editor to populate test data

-- Clear existing data (optional - comment out if you want to keep existing data)
-- TRUNCATE TABLE booking_activity_log CASCADE;
-- TRUNCATE TABLE bookings CASCADE;
-- TRUNCATE TABLE rooms CASCADE;
-- TRUNCATE TABLE locations CASCADE;
-- TRUNCATE TABLE users CASCADE;
-- TRUNCATE TABLE domain_integrations CASCADE;
-- TRUNCATE TABLE companies CASCADE;

-- Insert Companies
INSERT INTO companies (id, name, primary_domain, other_domains) VALUES
('11111111-1111-1111-1111-111111111111', 'Good Life Mortgage West', 'goodlifemortgagewest.com', ARRAY['glmw.com']),
('22222222-2222-2222-2222-222222222222', 'Good Life Construction', 'goodlifeconstruction.com', ARRAY['glc.com']),
('33333333-3333-3333-3333-333333333333', 'Good Life Realty', 'goodliferealty.com', ARRAY['glr.com'])
ON CONFLICT (id) DO NOTHING;

-- Insert Domain Integrations
INSERT INTO domain_integrations (id, company_id, domain, status) VALUES
('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'goodlifemortgagewest.com', 'active'),
('d2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'goodlifeconstruction.com', 'active'),
('d3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'goodliferealty.com', 'active')
ON CONFLICT (id) DO NOTHING;

-- Insert Locations
INSERT INTO locations (id, name, address, timezone, metadata) VALUES
('a1111111-1111-1111-1111-111111111111', 'Phoenix Office', '123 Main Street, Phoenix, AZ 85001', 'America/Phoenix', '{"building": "Main Tower", "floor": "3rd Floor"}'),
('a2222222-2222-2222-2222-222222222222', 'Scottsdale Office', '456 Scottsdale Road, Scottsdale, AZ 85251', 'America/Phoenix', '{"building": "North Tower", "floor": "2nd Floor"}'),
('a3333333-3333-3333-3333-333333333333', 'Tempe Office', '789 Mill Avenue, Tempe, AZ 85281', 'America/Phoenix', '{"building": "South Complex", "floor": "1st Floor"}')
ON CONFLICT (id) DO NOTHING;

-- Insert Test Users
INSERT INTO users (id, google_user_id, primary_email, name, company_id, is_admin, photo_url) VALUES
('u1111111-1111-1111-1111-111111111111', 'google_123', 'david@goodlifemortgagewest.com', 'David Khochay', '11111111-1111-1111-1111-111111111111', true, NULL),
('u2222222-2222-2222-2222-222222222222', 'google_456', 'sarah.johnson@goodlifemortgagewest.com', 'Sarah Johnson', '11111111-1111-1111-1111-111111111111', false, NULL),
('u3333333-3333-3333-3333-333333333333', 'google_789', 'mike.williams@goodlifeconstruction.com', 'Mike Williams', '22222222-2222-2222-2222-222222222222', false, NULL),
('u4444444-4444-4444-4444-444444444444', 'google_012', 'lisa.brown@goodliferealty.com', 'Lisa Brown', '33333333-3333-3333-3333-333333333333', true, NULL),
('u5555555-5555-5555-5555-555555555555', 'google_345', 'john.smith@goodlifemortgagewest.com', 'John Smith', '11111111-1111-1111-1111-111111111111', false, NULL),
('u6666666-6666-6666-6666-666666666666', 'google_678', 'emily.davis@goodlifeconstruction.com', 'Emily Davis', '22222222-2222-2222-2222-222222222222', false, NULL)
ON CONFLICT (id) DO NOTHING;

-- Insert Rooms
INSERT INTO rooms (id, name, location_id, capacity, features, allow_walk_up_booking, status, device_key) VALUES
-- Phoenix Office Rooms
('r1111111-1111-1111-1111-111111111111', 'Phoenix - Conference Room A', 'a1111111-1111-1111-1111-111111111111', 10, 
 '{"tv": true, "camera": true, "whiteboard": true, "projector": true, "video_conference": true}', true, 'active', 'phx-room-a-key'),
('r2222222-2222-2222-2222-222222222222', 'Phoenix - Conference Room B', 'a1111111-1111-1111-1111-111111111111', 8, 
 '{"tv": true, "camera": true, "whiteboard": true, "projector": false, "video_conference": true}', true, 'active', 'phx-room-b-key'),
('r3333333-3333-3333-3333-333333333333', 'Phoenix - Small Meeting Room', 'a1111111-1111-1111-1111-111111111111', 4, 
 '{"tv": true, "camera": false, "whiteboard": true, "projector": false, "video_conference": false}', true, 'active', 'phx-room-small-key'),
('r4444444-4444-4444-4444-444444444444', 'Phoenix - Board Room', 'a1111111-1111-1111-1111-111111111111', 16, 
 '{"tv": true, "camera": true, "whiteboard": true, "projector": true, "video_conference": true, "phone": true}', false, 'active', 'phx-boardroom-key'),

-- Scottsdale Office Rooms
('r5555555-5555-5555-5555-555555555555', 'Scottsdale - Conference Room A', 'a2222222-2222-2222-2222-222222222222', 12, 
 '{"tv": true, "camera": true, "whiteboard": true, "projector": true, "video_conference": true}', true, 'active', 'sco-room-a-key'),
('r6666666-6666-6666-6666-666666666666', 'Scottsdale - Training Room', 'a2222222-2222-2222-2222-222222222222', 20, 
 '{"tv": true, "camera": true, "whiteboard": true, "projector": true, "video_conference": false}', true, 'active', 'sco-training-key'),
('r7777777-7777-7777-7777-777777777777', 'Scottsdale - Huddle Room', 'a2222222-2222-2222-2222-222222222222', 4, 
 '{"tv": true, "camera": false, "whiteboard": false, "projector": false, "video_conference": true}', true, 'active', 'sco-huddle-key'),

-- Tempe Office Rooms
('r8888888-8888-8888-8888-888888888888', 'Tempe - Conference Room', 'a3333333-3333-3333-3333-333333333333', 10, 
 '{"tv": true, "camera": true, "whiteboard": true, "projector": true, "video_conference": true}', true, 'active', 'tmp-room-a-key'),
('r9999999-9999-9999-9999-999999999999', 'Tempe - Creative Space', 'a3333333-3333-3333-3333-333333333333', 6, 
 '{"tv": true, "camera": false, "whiteboard": true, "projector": false, "video_conference": false}', true, 'active', 'tmp-creative-key')
ON CONFLICT (id) DO NOTHING;

-- Insert some sample bookings for today and tomorrow
INSERT INTO bookings (room_id, host_user_id, title, description, start_time, end_time, source, status, attendee_emails) VALUES
-- Today's bookings
('r1111111-1111-1111-1111-111111111111', 'u1111111-1111-1111-1111-111111111111', 'Morning Standup', 'Daily team standup', 
 NOW() + INTERVAL '1 hour', NOW() + INTERVAL '1 hour 30 minutes', 'web', 'scheduled', 
 ARRAY['sarah.johnson@goodlifemortgagewest.com', 'john.smith@goodlifemortgagewest.com']),

('r2222222-2222-2222-2222-222222222222', 'u2222222-2222-2222-2222-222222222222', 'Client Presentation', 'Q4 results presentation', 
 NOW() + INTERVAL '2 hours', NOW() + INTERVAL '3 hours', 'web', 'scheduled', 
 ARRAY['david@goodlifemortgagewest.com']),

('r5555555-5555-5555-5555-555555555555', 'u3333333-3333-3333-3333-333333333333', 'Project Planning', 'New construction project kickoff', 
 NOW() + INTERVAL '3 hours', NOW() + INTERVAL '4 hours', 'web', 'scheduled', 
 ARRAY['emily.davis@goodlifeconstruction.com']),

-- Tomorrow's bookings
('r1111111-1111-1111-1111-111111111111', 'u4444444-4444-4444-4444-444444444444', 'Executive Meeting', 'Monthly executive sync', 
 NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 2 hours', 'web', 'scheduled', 
 ARRAY['david@goodlifemortgagewest.com', 'lisa.brown@goodliferealty.com']),

('r8888888-8888-8888-8888-888888888888', 'u5555555-5555-5555-5555-555555555555', 'Team Lunch & Learn', 'Learning session', 
 NOW() + INTERVAL '1 day 4 hours', NOW() + INTERVAL '1 day 5 hours', 'web', 'scheduled', 
 ARRAY['sarah.johnson@goodlifemortgagewest.com'])
ON CONFLICT DO NOTHING;

-- Verify the data
SELECT 'Companies Created:' as info, COUNT(*) as count FROM companies
UNION ALL
SELECT 'Locations Created:', COUNT(*) FROM locations
UNION ALL
SELECT 'Users Created:', COUNT(*) FROM users
UNION ALL
SELECT 'Rooms Created:', COUNT(*) FROM rooms
UNION ALL
SELECT 'Bookings Created:', COUNT(*) FROM bookings;

-- Show all rooms with their locations
SELECT 
  r.name as room_name,
  l.name as location_name,
  r.capacity,
  r.status
FROM rooms r
JOIN locations l ON r.location_id = l.id
ORDER BY l.name, r.name;

