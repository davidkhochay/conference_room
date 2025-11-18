# 🔧 Fix: No Companies Showing Up

## Problem
Locations are showing but companies are not.

## ✅ Solution: Run This SQL in Supabase

### Step 1: Go to Supabase
https://supabase.com/dashboard/project/xpzzvuaqiytgnaychoea

### Step 2: Click "SQL Editor" (left sidebar)

### Step 3: Copy and Paste This SQL

```sql
-- Check what exists
SELECT 'Locations' as table_name, COUNT(*) as count FROM locations
UNION ALL
SELECT 'Companies', COUNT(*) FROM companies
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Rooms', COUNT(*) FROM rooms;

-- If companies count is 0, add some:
INSERT INTO companies (name, primary_domain, other_domains) VALUES
('Good Life Mortgage West', 'goodlifemortgagewest.com', ARRAY['glmw.com']),
('Good Life Construction', 'goodlifeconstruction.com', ARRAY['glc.com']),
('Good Life Realty', 'goodliferealty.com', ARRAY['glr.com'])
ON CONFLICT DO NOTHING;

-- Add test users linked to companies
INSERT INTO users (google_user_id, primary_email, name, company_id, is_admin)
SELECT 
  'admin_001',
  'admin@goodlifemortgagewest.com',
  'David Khochay',
  id,
  true
FROM companies WHERE name = 'Good Life Mortgage West'
ON CONFLICT (google_user_id) DO NOTHING;

INSERT INTO users (google_user_id, primary_email, name, company_id, is_admin)
SELECT 
  'user_002',
  'user@goodlifeconstruction.com',
  'Test User',
  id,
  false
FROM companies WHERE name = 'Good Life Construction'
ON CONFLICT (google_user_id) DO NOTHING;

-- Verify again
SELECT 'Final Count:' as info;
SELECT 'Locations' as table_name, COUNT(*) as count FROM locations
UNION ALL
SELECT 'Companies', COUNT(*) FROM companies
UNION ALL
SELECT 'Users', COUNT(*) FROM users;

-- Show what was created
SELECT '=== COMPANIES ===' as section;
SELECT name, primary_domain FROM companies;

SELECT '=== USERS ===' as section;
SELECT name, primary_email, is_admin FROM users;
```

### Step 4: Click "RUN"

You should see:
- ✅ Locations: 3
- ✅ Companies: 3
- ✅ Users: 2+

### Step 5: Refresh Your Browser

Go to http://localhost:3000/admin/companies

You should now see all your companies!

---

## 🎯 What This Does

- Adds 3 Good Life Group companies
- Links users to those companies
- Verifies everything was created

---

## 🔍 Still Not Working?

### Check Browser Console

1. Press F12 (or Cmd+Option+I on Mac)
2. Go to Console tab
3. Look for errors (red text)
4. Share any errors you see

### Check Network Tab

1. Still in F12 Developer Tools
2. Go to Network tab
3. Refresh the page
4. Click on the `/api/admin/companies` request
5. Check the Response

---

## ✅ Success Checklist

After running the SQL, you should be able to:

- [ ] See companies at `/admin/companies`
- [ ] See locations at `/admin/locations`
- [ ] Create new rooms (location dropdown works)
- [ ] Text is visible in all input fields

