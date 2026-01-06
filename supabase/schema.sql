-- Good Life Group Conference Room Booking Platform
-- Database Schema for Supabase/PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies Table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  primary_domain TEXT NOT NULL,
  other_domains TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Domain Integrations Table
CREATE TABLE domain_integrations (
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
CREATE TABLE users (
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
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Phoenix',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rooms Table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  google_resource_id TEXT UNIQUE,
  google_calendar_id TEXT UNIQUE,
  capacity INTEGER NOT NULL DEFAULT 4,
  photo_url TEXT,
  features JSONB DEFAULT '{}', -- {tv: true, camera: true, whiteboard: true, etc}
  allow_walk_up_booking BOOLEAN NOT NULL DEFAULT true,
  max_booking_duration_minutes INTEGER, -- NULL means use global/location default
  device_key TEXT UNIQUE, -- For tablet authentication
  qr_code_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bookings Table
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  host_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for walk-up bookings
  title TEXT NOT NULL DEFAULT 'Room Booking',
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  google_event_id TEXT UNIQUE,
  google_calendar_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('tablet', 'web', 'api', 'admin', 'google_calendar')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'ended', 'cancelled', 'no_show')),
  check_in_time TIMESTAMPTZ,
  extended_count INTEGER NOT NULL DEFAULT 0,
  attendee_emails TEXT[] DEFAULT '{}',
  -- Optional metadata to support two-way Google Calendar sync
  external_source TEXT, -- e.g. 'google_ui' for events that originated in Google
  organizer_email TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Policies/Settings Table
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'location', 'room')),
  scope_id UUID, -- NULL for global, location_id or room_id for scoped
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(key, scope, scope_id)
);

-- Feature Requests Table
CREATE TABLE feature_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'shipped', 'declined')),
  votes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Booking Activity Log (for analytics and audit)
CREATE TABLE booking_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'checked_in', 'extended', 'ended_early', 'cancelled', 'no_show'
  performed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_email ON users(primary_email);
CREATE INDEX idx_domain_integrations_company ON domain_integrations(company_id);
CREATE INDEX idx_rooms_location ON rooms(location_id);
CREATE INDEX idx_rooms_google_resource ON rooms(google_resource_id);
CREATE INDEX idx_bookings_room ON bookings(room_id);
CREATE INDEX idx_bookings_host ON bookings(host_user_id);
CREATE INDEX idx_bookings_time_range ON bookings(start_time, end_time);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_booking_activity_booking ON booking_activity_log(booking_id);
CREATE INDEX idx_settings_scope ON settings(scope, scope_id);

-- Trigger functions for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_domain_integrations_updated_at BEFORE UPDATE ON domain_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_feature_requests_updated_at BEFORE UPDATE ON feature_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
-- Note: Adjust these based on your auth strategy

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_activity_log ENABLE ROW LEVEL SECURITY;

-- Allow service role to bypass RLS
CREATE POLICY "Service role can do anything" ON companies FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can do anything" ON domain_integrations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can do anything" ON users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can do anything" ON locations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can do anything" ON rooms FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can do anything" ON bookings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can do anything" ON settings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can do anything" ON feature_requests FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can do anything" ON booking_activity_log FOR ALL USING (auth.role() = 'service_role');

-- Public read access for authenticated users (adjust as needed)
CREATE POLICY "Authenticated users can read companies" ON companies FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read users" ON users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read locations" ON locations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read rooms" ON rooms FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read bookings" ON bookings FOR SELECT USING (auth.role() = 'authenticated');

-- Insert sample default settings
INSERT INTO settings (key, value, scope, description) VALUES
  ('max_booking_duration_minutes', '240', 'global', 'Maximum booking duration in minutes (4 hours)'),
  ('booking_hours_start', '7', 'global', 'Start of allowed booking hours (24h format)'),
  ('booking_hours_end', '19', 'global', 'End of allowed booking hours (24h format)'),
  ('auto_release_minutes', '15', 'global', 'Minutes to wait before auto-releasing a booking without check-in'),
  ('quick_booking_durations', '[15, 30, 45, 60]', 'global', 'Quick booking duration options in minutes'),
  ('no_show_grace_minutes', '10', 'global', 'Minutes after start before un-checked-in bookings are marked as no_show');

