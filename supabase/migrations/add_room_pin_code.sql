-- Add pin_code column to rooms table for physical door keypad codes
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS pin_code TEXT;

-- Ensure pin_code is exactly 4 digits when provided
ALTER TABLE rooms ADD CONSTRAINT pin_code_format CHECK (pin_code IS NULL OR pin_code ~ '^\d{4}$');

-- Add comment for documentation
COMMENT ON COLUMN rooms.pin_code IS 'Optional 4-digit PIN code for rooms with physical keypad locks. Only shown to users who have checked in.';

