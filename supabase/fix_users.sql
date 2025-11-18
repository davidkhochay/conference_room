-- Fix users table schema
ALTER TABLE users 
  ALTER COLUMN google_user_id DROP NOT NULL,
  ALTER COLUMN company_id DROP NOT NULL;

-- Rename primary_email to email
ALTER TABLE users RENAME COLUMN primary_email TO email;

-- Add role column
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Drop is_admin if exists and migrate data
UPDATE users SET role = 'admin' WHERE is_admin = true;
ALTER TABLE users DROP COLUMN IF EXISTS is_admin;
