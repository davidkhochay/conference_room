# 🧪 Test Data Setup Instructions

## Problem: Can't Create Rooms?

**Reason:** Rooms require locations to exist first! Here's how to fix it.

## ✅ Solution: Run Quick Seed Script

### Option 1: Quick Seed (Minimal - Get Started Fast!)

1. Go to Supabase: https://supabase.com/dashboard/project/xpzzvuaqiytgnaychoea

2. Click **SQL Editor** in the left sidebar

3. Copy and paste this SQL:

```sql
-- Add 3 Locations
INSERT INTO locations (name, address, timezone) VALUES
('Phoenix Office', '123 Main St, Phoenix, AZ 85001', 'America/Phoenix'),
('Scottsdale Office', '456 Scottsdale Rd, Scottsdale, AZ 85251', 'America/Phoenix'),
('Tempe Office', '789 Mill Ave, Tempe, AZ 85281', 'America/Phoenix')
ON CONFLICT DO NOTHING;

-- Add a Company
INSERT INTO companies (name, primary_domain) VALUES
('Good Life Group', 'goodlifegroup.com')
ON CONFLICT DO NOTHING;

-- Add Test Users
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

-- Verify
SELECT 'Locations:' as type, name FROM locations
UNION ALL
SELECT 'Companies:', name FROM companies
UNION ALL
SELECT 'Users:', name FROM users;
```

4. Click **Run**

✅ **Done!** Now you can create rooms in the admin panel!

---

### Option 2: Full Seed (Complete Test Environment)

For a more complete test setup with rooms and bookings already created:

1. Open the file `supabase/seed.sql` in your code editor

2. Copy **ALL** contents (it's long - about 200 lines)

3. Paste into Supabase SQL Editor

4. Click **Run**

This creates:
- ✅ 3 Companies (Good Life Mortgage West, Construction, Realty)
- ✅ 3 Locations (Phoenix, Scottsdale, Tempe)
- ✅ 6 Test Users (including admins)
- ✅ 9 Conference Rooms (fully configured)
- ✅ 5 Sample Bookings (to see the system in action)

---

## 🎯 After Adding Data

### Test the Admin Panel

1. Go to http://localhost:3000/admin/rooms
2. Click **"Add Room"**
3. You should now see location dropdown populated!

### Create Your First Room

Fill in the form:
- **Room Name**: "Conference Room A"
- **Location**: Select "Phoenix Office"
- **Capacity**: 10
- **Features**: Check TV, Camera, Whiteboard
- Click **"Create Room"**

### Test Booking Interface

1. Go to http://localhost:3000/book
2. You should see the room you just created
3. Click "Book This Room"
4. Fill out the form and test booking

### Test Tablet Display

1. Get a room ID from admin panel (click on a room, copy the ID from URL)
2. Go to http://localhost:3000/tablet/[ROOM-ID]
3. Try the quick booking buttons (15/30/45/60 min)

---

## 📋 What You Get

### From Quick Seed:
```
✓ 3 Locations
✓ 1 Company
✓ 2 Users (1 admin, 1 regular)
```

### From Full Seed:
```
✓ 3 Companies
✓ 3 Locations  
✓ 6 Users
✓ 9 Rooms (fully configured with features)
✓ 5 Bookings (sample data to explore)
```

---

## 🔧 Alternative: Use the UI

Instead of SQL, you can also:

### Add Locations via Admin Panel

1. Go to http://localhost:3000/admin/locations
2. Click **"Add Location"**
3. Fill in:
   - Name: Phoenix Office
   - Address: 123 Main St, Phoenix, AZ
   - Timezone: America/Phoenix
4. Click **"Create Location"**

### Then Add Rooms

1. Go to http://localhost:3000/admin/rooms
2. Click **"Add Room"**
3. Now the location dropdown will work!

---

## 🐛 Troubleshooting

### "No locations found" when creating room
**Fix:** Run the Quick Seed SQL above

### Locations not showing in dropdown
**Fix:** 
1. Check Supabase → Table Editor → locations table has data
2. Refresh the page
3. Check browser console for errors

### Can't see test data
**Fix:** 
1. Make sure SQL ran without errors in Supabase
2. Check the verification query at the end shows data
3. Refresh your admin panel

---

## 📚 Files Reference

- **Quick seed**: `scripts/quick-seed.sql` (minimal)
- **Full seed**: `supabase/seed.sql` (complete test environment)
- **Schema**: `supabase/schema.sql` (database structure - run this first!)

---

## ✅ Success Checklist

After running seed data, verify:

- [ ] Can see locations in admin panel
- [ ] Location dropdown works when creating room
- [ ] Can successfully create a room
- [ ] Room appears in rooms list
- [ ] Can see room in booking interface
- [ ] Tablet display works for the room

---

**That's it! You now have test data and can create rooms! 🎉**

