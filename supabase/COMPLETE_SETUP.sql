-- ============================================================================
-- GOOD LIFE GROUP - CONFERENCE ROOM BOOKING PLATFORM
-- COMPLETE DATABASE SETUP
-- ============================================================================
-- Run this entire file in Supabase SQL Editor to set up everything
-- ============================================================================

-- ============================================================================
-- PART 1: EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PART 2: TABLES
-- ============================================================================

-- Companies Table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  primary_domain TEXT NOT NULL,
  other_domains TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Domain Integrations Table
CREATE TABLE IF NOT EXISTS domain_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  google_customer_id TEXT,
  google_admin_email TEXT,
  oauth_refresh_token TEXT,
  service_account_config JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'error', 'disabled')),
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_user_id TEXT NOT NULL UNIQUE,
  primary_email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_location_manager BOOLEAN NOT NULL DEFAULT false,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Locations Table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Phoenix',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  google_resource_id TEXT UNIQUE,
  google_calendar_id TEXT UNIQUE,
  capacity INTEGER NOT NULL DEFAULT 4,
  photo_url TEXT,
  features JSONB DEFAULT '{}',
  allow_walk_up_booking BOOLEAN NOT NULL DEFAULT true,
  max_booking_duration_minutes INTEGER,
  device_key TEXT UNIQUE,
  qr_code_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  host_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Room Booking',
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  google_event_id TEXT UNIQUE,
  google_calendar_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('tablet', 'web', 'api', 'admin')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'ended', 'cancelled', 'no_show')),
  check_in_time TIMESTAMPTZ,
  extended_count INTEGER NOT NULL DEFAULT 0,
  attendee_emails TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'location', 'room')),
  scope_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(key, scope, scope_id)
);

-- Feature Requests Table
CREATE TABLE IF NOT EXISTS feature_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'shipped', 'declined')),
  votes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Booking Activity Log Table
CREATE TABLE IF NOT EXISTS booking_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PART 3: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(primary_email);
CREATE INDEX IF NOT EXISTS idx_domain_integrations_company ON domain_integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_rooms_location ON rooms(location_id);
CREATE INDEX IF NOT EXISTS idx_rooms_google_resource ON rooms(google_resource_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_host ON bookings(host_user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_time_range ON bookings(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_booking_activity_booking ON booking_activity_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_settings_scope ON settings(scope, scope_id);

-- ============================================================================
-- PART 4: TRIGGERS
-- ============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_domain_integrations_updated_at ON domain_integrations;
CREATE TRIGGER update_domain_integrations_updated_at BEFORE UPDATE ON domain_integrations 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_locations_updated_at ON locations;
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feature_requests_updated_at ON feature_requests;
CREATE TRIGGER update_feature_requests_updated_at BEFORE UPDATE ON feature_requests 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 5: ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_activity_log ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies
DROP POLICY IF EXISTS "Service role can do anything" ON companies;
CREATE POLICY "Service role can do anything" ON companies FOR ALL 
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can do anything" ON domain_integrations;
CREATE POLICY "Service role can do anything" ON domain_integrations FOR ALL 
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can do anything" ON users;
CREATE POLICY "Service role can do anything" ON users FOR ALL 
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can do anything" ON locations;
CREATE POLICY "Service role can do anything" ON locations FOR ALL 
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can do anything" ON rooms;
CREATE POLICY "Service role can do anything" ON rooms FOR ALL 
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can do anything" ON bookings;
CREATE POLICY "Service role can do anything" ON bookings FOR ALL 
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can do anything" ON settings;
CREATE POLICY "Service role can do anything" ON settings FOR ALL 
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can do anything" ON feature_requests;
CREATE POLICY "Service role can do anything" ON feature_requests FOR ALL 
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can do anything" ON booking_activity_log;
CREATE POLICY "Service role can do anything" ON booking_activity_log FOR ALL 
USING (auth.role() = 'service_role');

-- Public read policies
DROP POLICY IF EXISTS "Authenticated users can read companies" ON companies;
CREATE POLICY "Authenticated users can read companies" ON companies FOR SELECT 
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read users" ON users;
CREATE POLICY "Authenticated users can read users" ON users FOR SELECT 
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read locations" ON locations;
CREATE POLICY "Authenticated users can read locations" ON locations FOR SELECT 
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read rooms" ON rooms;
CREATE POLICY "Authenticated users can read rooms" ON rooms FOR SELECT 
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read bookings" ON bookings;
CREATE POLICY "Authenticated users can read bookings" ON bookings FOR SELECT 
USING (auth.role() = 'authenticated');

-- ============================================================================
-- PART 6: DEFAULT SETTINGS
-- ============================================================================

INSERT INTO settings (key, value, scope, description) VALUES
  ('max_booking_duration_minutes', '240', 'global', 'Maximum booking duration in minutes (4 hours)'),
  ('booking_hours_start', '7', 'global', 'Start of allowed booking hours (24h format)'),
  ('booking_hours_end', '19', 'global', 'End of allowed booking hours (24h format)'),
  ('auto_release_minutes', '15', 'global', 'Minutes to wait before auto-releasing a booking without check-in'),
  ('quick_booking_durations', '[15, 30, 45, 60]', 'global', 'Quick booking duration options in minutes')
ON CONFLICT (key, scope, scope_id) DO NOTHING;

-- ============================================================================
-- PART 7: SAMPLE DATA (Optional - Comment out if you don't want test data)
-- ============================================================================

-- Insert Companies
INSERT INTO companies (id, name, primary_domain, other_domains) VALUES
('11111111-1111-1111-1111-111111111111', 'Good Life Mortgage West', 'goodlifemortgagewest.com', ARRAY['glmw.com']),
('22222222-2222-2222-2222-222222222222', 'Good Life Construction', 'goodlifeconstruction.com', ARRAY['glc.com']),
('33333333-3333-3333-3333-333333333333', 'Good Life Realty', 'goodliferealty.com', ARRAY['glr.com'])
ON CONFLICT (id) DO NOTHING;

-- Insert Locations
INSERT INTO locations (id, name, address, timezone, metadata) VALUES
('a1111111-1111-1111-1111-111111111111', 'Phoenix Office', '123 Main Street, Phoenix, AZ 85001', 'America/Phoenix', '{"building": "Main Tower", "floor": "3rd Floor"}'),
('a2222222-2222-2222-2222-222222222222', 'Scottsdale Office', '456 Scottsdale Road, Scottsdale, AZ 85251', 'America/Phoenix', '{"building": "North Tower", "floor": "2nd Floor"}'),
('a3333333-3333-3333-3333-333333333333', 'Tempe Office', '789 Mill Avenue, Tempe, AZ 85281', 'America/Phoenix', '{"building": "South Complex", "floor": "1st Floor"}')
ON CONFLICT (id) DO NOTHING;

-- Insert Test Users
INSERT INTO users (id, google_user_id, primary_email, name, company_id, is_admin) VALUES
('u1111111-1111-1111-1111-111111111111', 'google_123', 'david@goodlifemortgagewest.com', 'David Khochay', '11111111-1111-1111-1111-111111111111', true),
('u2222222-2222-2222-2222-222222222222', 'google_456', 'sarah.johnson@goodlifemortgagewest.com', 'Sarah Johnson', '11111111-1111-1111-1111-111111111111', false),
('u3333333-3333-3333-3333-333333333333', 'google_789', 'mike.williams@goodlifeconstruction.com', 'Mike Williams', '22222222-2222-2222-2222-222222222222', false),
('u4444444-4444-4444-4444-444444444444', 'google_012', 'lisa.brown@goodliferealty.com', 'Lisa Brown', '33333333-3333-3333-3333-333333333333', true),
('u5555555-5555-5555-5555-555555555555', 'google_345', 'john.smith@goodlifemortgagewest.com', 'John Smith', '11111111-1111-1111-1111-111111111111', false)
ON CONFLICT (google_user_id) DO NOTHING;

-- Insert Rooms
INSERT INTO rooms (id, name, location_id, capacity, features, allow_walk_up_booking, status, device_key) VALUES
-- Phoenix Office Rooms
('r1111111-1111-1111-1111-111111111111', 'Phoenix - Conference Room A', 'a1111111-1111-1111-1111-111111111111', 10, 
 '{"tv": true, "camera": true, "whiteboard": true, "projector": true, "video_conference": true}', true, 'active', 'phx-room-a-key'),
('r2222222-2222-2222-2222-222222222222', 'Phoenix - Conference Room B', 'a1111111-1111-1111-1111-111111111111', 8, 
 '{"tv": true, "camera": true, "whiteboard": true, "projector": false, "video_conference": true}', true, 'active', 'phx-room-b-key'),
('r3333333-3333-3333-3333-333333333333', 'Phoenix - Small Meeting Room', 'a1111111-1111-1111-1111-111111111111', 4, 
 '{"tv": true, "camera": false, "whiteboard": true, "projector": false, "video_conference": false}', true, 'active', 'phx-room-small-key'),

-- Scottsdale Office Rooms
('r5555555-5555-5555-5555-555555555555', 'Scottsdale - Conference Room A', 'a2222222-2222-2222-2222-222222222222', 12, 
 '{"tv": true, "camera": true, "whiteboard": true, "projector": true, "video_conference": true}', true, 'active', 'sco-room-a-key'),
('r6666666-6666-6666-6666-666666666666', 'Scottsdale - Training Room', 'a2222222-2222-2222-2222-222222222222', 20, 
 '{"tv": true, "camera": true, "whiteboard": true, "projector": true, "video_conference": false}', true, 'active', 'sco-training-key'),

-- Tempe Office Rooms
('r8888888-8888-8888-8888-888888888888', 'Tempe - Conference Room', 'a3333333-3333-3333-3333-333333333333', 10, 
 '{"tv": true, "camera": true, "whiteboard": true, "projector": true, "video_conference": true}', true, 'active', 'tmp-room-a-key')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PART 8: STORAGE BUCKET SETUP
-- ============================================================================

-- Note: Storage buckets must be created via the Supabase Dashboard UI
-- Go to Storage > New Bucket > Name: "room-photos" > Public: YES

-- Then run these storage policies:

-- Public Read Policy for room photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('room-photos', 'room-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Public can view room photos" ON storage.objects;
CREATE POLICY "Public can view room photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'room-photos');

DROP POLICY IF EXISTS "Service role can upload" ON storage.objects;
CREATE POLICY "Service role can upload"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'room-photos');

DROP POLICY IF EXISTS "Service role can update" ON storage.objects;
CREATE POLICY "Service role can update"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'room-photos');

DROP POLICY IF EXISTS "Service role can delete" ON storage.objects;
CREATE POLICY "Service role can delete"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'room-photos');

-- ============================================================================
-- PART 9: VERIFICATION
-- ============================================================================

-- Verify what was created
SELECT '=== DATABASE SETUP COMPLETE ===' as message;
SELECT '' as blank;

SELECT 'TABLES CREATED:' as section;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

SELECT '' as blank;
SELECT 'DATA COUNTS:' as section;
SELECT 'Companies' as table_name, COUNT(*) as count FROM companies
UNION ALL
SELECT 'Locations', COUNT(*) FROM locations
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Rooms', COUNT(*) FROM rooms
UNION ALL
SELECT 'Settings', COUNT(*) FROM settings;

SELECT '' as blank;
SELECT 'SAMPLE COMPANIES:' as section;
SELECT name, primary_domain FROM companies ORDER BY name;

SELECT '' as blank;
SELECT 'SAMPLE LOCATIONS:' as section;
SELECT name, address FROM locations ORDER BY name;

SELECT '' as blank;
SELECT 'SAMPLE ROOMS:' as section;
SELECT r.name, l.name as location, r.capacity, r.status 
FROM rooms r 
JOIN locations l ON r.location_id = l.id
ORDER BY l.name, r.name;

SELECT '' as blank;
SELECT '=== SETUP SUCCESSFUL ===' as message;
SELECT 'Next Steps:' as info;
SELECT '1. Create storage bucket "room-photos" in Supabase Dashboard (Storage > New Bucket)' as step;
SELECT '2. Mark bucket as PUBLIC' as step;
SELECT '3. Run your Next.js app: npm run dev' as step;
SELECT '4. Visit: http://localhost:3000' as step;

-- ============================================================================
-- END OF SETUP
-- ============================================================================

