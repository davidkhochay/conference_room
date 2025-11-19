import { createClient } from '@supabase/supabase-js';

// Browser client with anon key. Safe for use in client components.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

