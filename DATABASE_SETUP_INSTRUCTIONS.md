# 🗄️ Complete Database Setup - Quick Guide

## 📋 What You'll Do

Run **ONE SQL file** that sets up everything:
- ✅ All tables
- ✅ Indexes & triggers
- ✅ Security policies
- ✅ Sample data (3 companies, 3 locations, 6 rooms, 5 users)
- ✅ Default settings
- ✅ Storage policies

---

## ⚡ Quick Setup (3 minutes)

### Step 1: Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/xpzzvuaqiytgnaychoea
2. Click **SQL Editor** in the left sidebar
3. Click **"New Query"**

### Step 2: Run the Complete Setup SQL

1. Open the file: `supabase/COMPLETE_SETUP.sql` 
2. Copy **ALL** contents (it's about 500 lines)
3. Paste into Supabase SQL Editor
4. Click **"RUN"** (bottom right)

⏱️ Should take 5-10 seconds to complete.

### Step 3: Create Storage Bucket (Manual Step)

**Important**: Storage buckets can't be created via SQL, must use UI:

1. Still in Supabase Dashboard, click **Storage** (left sidebar)
2. Click **"New bucket"** button
3. Fill in:
   - **Name**: `room-photos` (exact name!)
   - **Public bucket**: ✅ **CHECK THIS BOX**
4. Click **"Create bucket"**

### Step 4: Verify Setup

The SQL will output verification at the end showing:
- ✅ Tables created
- ✅ Data counts
- ✅ Sample companies
- ✅ Sample locations  
- ✅ Sample rooms

Look for: `=== SETUP SUCCESSFUL ===`

---

## ✅ What Gets Created

### Tables (9 total):
- `companies` - Good Life Group companies
- `locations` - Office locations
- `rooms` - Conference rooms
- `users` - User directory
- `bookings` - Room reservations
- `domain_integrations` - Google Workspace connections
- `settings` - Configuration
- `feature_requests` - User feedback
- `booking_activity_log` - Audit trail

### Sample Data:
- **3 Companies**: Mortgage West, Construction, Realty
- **3 Locations**: Phoenix, Scottsdale, Tempe
- **6 Conference Rooms**: Various capacities and features
- **5 Test Users**: Including David (admin) and team members
- **Default Settings**: Booking rules and limits

### Security:
- ✅ Row Level Security (RLS) enabled
- ✅ Service role can do everything
- ✅ Authenticated users can read
- ✅ Public can't access directly

---

## 🎯 After Setup

### Test Your Database:

1. **In Supabase Dashboard** → Table Editor:
   - Click `companies` → Should see 3 companies
   - Click `locations` → Should see 3 locations
   - Click `rooms` → Should see 6 rooms
   - Click `users` → Should see 5 users

2. **In Your App**:
   ```bash
   npm run dev
   ```
   
   Visit:
   - http://localhost:3000/admin/companies → See 3 companies
   - http://localhost:3000/admin/locations → See 3 locations
   - http://localhost:3000/admin/rooms → See 6 rooms

---

## 🔧 Troubleshooting

### "relation already exists" errors?
**This is OK!** The SQL uses `CREATE TABLE IF NOT EXISTS` and `ON CONFLICT DO NOTHING`.
It's safe to run multiple times.

### No data showing in app?
1. Check `.env.local` file exists with correct credentials
2. Restart dev server: `npm run dev`
3. Check browser console (F12) for errors

### Storage bucket errors?
Make sure you:
1. Created `room-photos` bucket (exact name)
2. Marked it as **Public**
3. Bucket shows in Storage section

### Can't upload images?
Storage policies might not have applied. Go to:
Storage → room-photos → Policies

Should see 4 policies. If not, run Part 8 of the SQL again.

---

## 📊 What's Included

### Sample Companies:
```
- Good Life Mortgage West (goodlifemortgagewest.com)
- Good Life Construction (goodlifeconstruction.com)
- Good Life Realty (goodliferealty.com)
```

### Sample Locations:
```
- Phoenix Office (123 Main Street)
- Scottsdale Office (456 Scottsdale Road)
- Tempe Office (789 Mill Avenue)
```

### Sample Rooms:
```
Phoenix:
  - Conference Room A (10 people, full features)
  - Conference Room B (8 people)
  - Small Meeting Room (4 people)

Scottsdale:
  - Conference Room A (12 people)
  - Training Room (20 people)

Tempe:
  - Conference Room (10 people)
```

### Sample Users:
```
- David Khochay (Admin)
- Sarah Johnson (User)
- Mike Williams (User)
- Lisa Brown (Admin)
- John Smith (User)
```

---

## 🚮 Clean Slate (Optional)

If you want to start fresh, run this FIRST before the setup:

```sql
-- WARNING: This deletes ALL data!
DROP TABLE IF EXISTS booking_activity_log CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS feature_requests CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS domain_integrations CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
```

Then run the `COMPLETE_SETUP.sql` file.

---

## 📝 Manual Steps Summary

Only 3 manual steps needed:

1. ✅ Run `COMPLETE_SETUP.sql` in Supabase SQL Editor
2. ✅ Create `room-photos` storage bucket (mark as Public)
3. ✅ Start your app: `npm run dev`

Everything else is automated!

---

## 🎉 Success Checklist

After setup, you should be able to:

- [ ] See companies in `/admin/companies`
- [ ] See locations in `/admin/locations`
- [ ] See rooms in `/admin/rooms`
- [ ] Create new rooms
- [ ] Upload room photos
- [ ] Book rooms via `/book`
- [ ] View tablet display `/tablet/[room-id]`

---

## 💡 Pro Tips

1. **Keep the SQL file**: You can re-run it anytime (it's safe)
2. **Customize sample data**: Edit Part 7 of SQL before running
3. **Add more locations**: Use admin panel after setup
4. **Production ready**: Just update `.env` variables

---

**You're ready to go! Run that SQL file and start booking rooms! 🚀**

