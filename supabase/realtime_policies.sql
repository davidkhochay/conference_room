-- Allow realtime subscriptions for bookings table
-- This policy allows clients to subscribe to changes on the bookings table

-- First, check if RLS is enabled
-- If you see policies on the bookings table, RLS is active

-- Add a policy to allow SELECT for realtime (clients need read access to subscribe)
-- Note: Adjust this based on your security needs

-- For service role (admin/backend operations) - already exists likely
CREATE POLICY IF NOT EXISTS "Enable read access for service role" 
ON bookings FOR SELECT 
TO service_role
USING (true);

-- For authenticated users (if you want logged-in users to see realtime updates)
CREATE POLICY IF NOT EXISTS "Enable read access for authenticated users" 
ON bookings FOR SELECT 
TO authenticated
USING (true);

-- For anonymous users (if you want public booking pages to get realtime)
-- Be cautious with this - only enable if your app allows anonymous booking viewing
CREATE POLICY IF NOT EXISTS "Enable read access for anonymous users" 
ON bookings FOR SELECT 
TO anon
USING (true);

-- Verify policies (optional)
-- SELECT * FROM pg_policies WHERE tablename = 'bookings';

