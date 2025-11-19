# Database Migration Required

To save test pins, you need to add a column to your Supabase database.

## Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Paste this SQL:

```sql
ALTER TABLE floors ADD COLUMN IF NOT EXISTS test_pins JSONB DEFAULT NULL;
```

5. Click **Run** (or press Cmd/Ctrl + Enter)

## Option 2: Using the SQL file

The SQL migration file has been created at: `supabase/add_test_pins.sql`

You can run it using:
- Supabase CLI: `supabase db push`
- Or copy/paste the contents into Supabase SQL Editor

## What This Does

Adds a `test_pins` column to the `floors` table that stores the positions of your 4 test pins as JSON.

## After Running the Migration

1. Refresh your app
2. Place your test pins on the floor plan
3. Click "Save Changes"
4. Refresh the page - the pins will stay in place!

