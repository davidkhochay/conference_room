-- QUICK SEED - Minimal test data to get started fast
-- Copy and paste this into Supabase SQL Editor

-- 1. Add Locations (REQUIRED for creating rooms)
INSERT INTO locations (name, address, timezone) VALUES
('Phoenix Office', '123 Main St, Phoenix, AZ 85001', 'America/Phoenix'),
('Scottsdale Office', '456 Scottsdale Rd, Scottsdale, AZ 85251', 'America/Phoenix'),
('Tempe Office', '789 Mill Ave, Tempe, AZ 85281', 'America/Phoenix')
ON CONFLICT DO NOTHING;

-- 2. Add a Company
INSERT INTO companies (name, primary_domain) VALUES
('Good Life Group', 'goodlifegroup.com')
ON CONFLICT DO NOTHING;

-- 3. Add Test Users
INSERT INTO users (google_user_id, primary_email, name, company_id, is_admin)
SELECT 
  'test_admin_001',
  'admin@goodlifegroup.com',
  'Admin User',
  id,
  true
FROM companies WHERE name = 'Good Life Group'
ON CONFLICT (google_user_id) DO NOTHING;

INSERT INTO users (google_user_id, primary_email, name, company_id, is_admin)
SELECT 
  'test_user_001',
  'user@goodlifegroup.com',
  'Test User',
  id,
  false
FROM companies WHERE name = 'Good Life Group'
ON CONFLICT (google_user_id) DO NOTHING;

-- 4. Show what was created
SELECT 'Locations:' as type, name FROM locations
UNION ALL
SELECT 'Companies:', name FROM companies
UNION ALL
SELECT 'Users:', name FROM users;

-- Now you can create rooms in the admin panel!
-- Or add rooms directly:
/*
INSERT INTO rooms (name, location_id, capacity, features, status)
SELECT 
  'Test Conference Room',
  l.id,
  10,
  '{"tv": true, "camera": true, "whiteboard": true}'::jsonb,
  'active'
FROM locations l WHERE l.name = 'Phoenix Office';
*/

