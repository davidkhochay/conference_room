-- Create floors table
CREATE TABLE IF NOT EXISTS floors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  width DOUBLE PRECISION DEFAULT 1000,
  height DOUBLE PRECISION DEFAULT 1000,
  svg_content TEXT, -- For storing custom drawn walls/shapes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add floor-related columns to rooms
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS floor_id UUID REFERENCES floors(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS map_position JSONB; -- Stores coordinates/shape data for the map

-- Indexes
CREATE INDEX IF NOT EXISTS idx_floors_location ON floors(location_id);
CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(floor_id);

-- Enable RLS (if used generally, though currently we rely on service role mostly in API)
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;

-- Basic policies (adjust if strict RLS is enforced)
CREATE POLICY "Public read access for floors" ON floors FOR SELECT USING (true);
CREATE POLICY "Admin full access for floors" ON floors USING (true); -- Simplified for now

