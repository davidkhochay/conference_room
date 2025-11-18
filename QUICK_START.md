# 🚀 Quick Start Guide - Get Running in 5 Minutes!

Follow these steps to get your Good Life Room Booking platform up and running with test data.

## Step 1: Set Up Database Schema (2 minutes)

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/xpzzvuaqiytgnaychoea

2. Click on **SQL Editor** in the left sidebar

3. Open the file `supabase/schema.sql` in your code editor, copy ALL the contents

4. Paste into Supabase SQL Editor and click **Run**

✅ You should see: "Success. No rows returned"

## Step 2: Add Test Data (1 minute)

Still in Supabase SQL Editor:

1. Open the file `scripts/quick-seed.sql` from your project

2. Copy and paste into Supabase SQL Editor

3. Click **Run**

✅ You should see output showing:
```
Locations: Phoenix Office
Locations: Scottsdale Office  
Locations: Tempe Office
Companies: Good Life Group
Users: Admin User
Users: Test User
```

**OR** for more comprehensive test data, use `supabase/seed.sql` instead - it includes:
- 3 companies
- 3 locations
- 6 test users
- 9 conference rooms
- 5 sample bookings

## Step 3: Run the Application (1 minute)

In your terminal:

```bash
cd /Users/davidkhochay/Documents/Saas/conference_room_glc
npm run dev
```

Wait for: `✓ Ready on http://localhost:3000`

## Step 4: Test It Out! (1 minute)

Open your browser to these URLs:

### 🏠 Home Page
http://localhost:3000

### 📅 Book a Room
http://localhost:3000/book

### 👨‍💼 Admin Panel
http://localhost:3000/admin

- View all rooms: http://localhost:3000/admin/rooms
- Create new room: Click "Add Room" button
- View dashboard: http://localhost:3000/admin

### 📱 Tablet Display (pick any room ID from your database)
http://localhost:3000/tablet/r1111111-1111-1111-1111-111111111111

(If you used seed.sql, otherwise get a room ID from the admin panel)

## ✅ Verification Checklist

- [ ] Database schema created (no errors in Supabase)
- [ ] Test data loaded (locations, users, rooms visible)
- [ ] App running on localhost:3000
- [ ] Can see rooms in admin panel
- [ ] Can create new rooms
- [ ] Can browse rooms in booking interface
- [ ] Tablet display shows room status

## 🔧 Troubleshooting

### "No locations found" when creating room
**Fix:** Run `scripts/quick-seed.sql` in Supabase SQL Editor

### Can't connect to database
**Fix:** Check `.env.local` has correct Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xpzzvuaqiytgnaychoea.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Port 3000 already in use
**Fix:** 
```bash
# Kill the process on port 3000
lsof -ti:3000 | xargs kill -9

# Or run on different port
npm run dev -- -p 3001
```

### "Module not found" errors
**Fix:**
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

## 🎯 Next Steps

Now that it's running:

1. **Create more rooms** via Admin Panel → Rooms → Add Room
2. **Make test bookings** via Book a Room interface
3. **Test tablet interface** - open `/tablet/[room-id]` on another device
4. **Configure Google Calendar** (optional for now) - see SETUP.md
5. **Add your real companies** - Admin Panel → Companies

## 📚 Full Documentation

- **Detailed Setup**: `SETUP.md`
- **API Reference**: `API_REFERENCE.md`
- **Main README**: `README.md`

## 🆘 Still Having Issues?

Common fixes:

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
npm install --legacy-peer-deps

# Restart dev server
npm run dev
```

Check the console for error messages and search in the documentation files.

---

**You should now have a fully functional conference room booking system! 🎉**

Try creating a booking, testing the tablet display, and exploring the admin panel.

