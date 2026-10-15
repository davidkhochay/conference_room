# Moving Supabase from the Exodus account to goodlifegrp.com

## What the app depends on in Supabase

| Touchpoint | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `.env.local`, Vercel env | The only config the app reads. No hardcoded URL or key in app code. |
| Postgres schema + data | `supabase/*.sql`, `supabase/migrations/*.sql` | Tables, `update_updated_at_column` trigger function, RLS policies. |
| Realtime | `supabase/enable_realtime.sql`, `app/tablet/[roomId]/page.tsx` | `bookings` must be in the `supabase_realtime` publication or tablets stop live-updating. |
| Storage | `app/api/upload/route.ts`, `supabase/COMPLETE_SETUP.sql` (storage section) | Public bucket `room-photos`. Full public URLs are saved in `rooms.photo_url`, `users.photo_url`, `floors.image_url`, so they embed the project ref. |
| Supabase Auth | none | The app does not use Supabase Auth, so there are no auth users or redirect URLs to move. |
| Edge functions / pg_cron | none | Cron runs in the app (`app/api/cron/overdue-reminders`), not in Supabase. |

## Route A (recommended): transfer the project between organizations

Supabase can move a project to another organization. The project ref, URL, keys, data, storage files and realtime config stay exactly as they are, so nothing in the app or in Vercel changes and there is no downtime.

1. Sign in to Supabase with the goodlifegrp.com account and create (or pick) the Goodlife organization. Choose its plan before moving: a Free org allows only 2 active free projects.
2. In the Exodus org, invite the goodlifegrp.com account as **Owner** (Organization settings > Team) and accept the invite. Transfer requires owner rights on the source org and membership in the target org.
3. Open the project > Project Settings > General > **Transfer project**, pick the Goodlife org, confirm. If the dialog lists blockers (for example a GitHub or Vercel integration attached to the org), disconnect them and reconnect them under the Goodlife org afterwards.
4. Check the app still loads, a booking can be created, and a tablet updates live.
5. Once the Exodus org is empty, remove the Exodus account from it or delete the org.

Shortcut if the goal is only "log in with goodlifegrp.com": do step 2, then remove the Exodus account and rename the org. No transfer needed.

## Route B: new project in the Goodlife org (only if transfer is not possible)

1. Create the project in the Goodlife org (same region as the old one).
2. Dump and restore Postgres with the Supabase CLI:
   ```bash
   supabase db dump --db-url "$OLD_DB_URL" -f roles.sql --role-only
   supabase db dump --db-url "$OLD_DB_URL" -f schema.sql
   supabase db dump --db-url "$OLD_DB_URL" -f data.sql --use-copy --data-only
   psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
     -c 'SET session_replication_role = replica' \
     -f roles.sql -f schema.sql -f data.sql
   ```
   DB URLs are under Project Settings > Database > Connection string (use the session pooler or direct connection).
3. Re-run `supabase/enable_realtime.sql` in the new project and confirm `bookings` shows in `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';`.
4. Copy storage files and repoint saved URLs:
   ```bash
   OLD_SUPABASE_URL=... OLD_SUPABASE_SERVICE_ROLE_KEY=... \
   NEW_SUPABASE_URL=... NEW_SUPABASE_SERVICE_ROLE_KEY=... \
   node scripts/migrate-storage.js
   ```
   It creates the public `room-photos` bucket if missing, copies every object, then prints `UPDATE` statements; run those in the new project's SQL editor. Re-apply the storage policies from the storage section of `supabase/COMPLETE_SETUP.sql` if the dump did not carry them.
5. Swap the three env vars in Vercel (Production and Preview) and in `.env.local`, then **redeploy**: `NEXT_PUBLIC_*` values are baked in at build time.
6. Verify with `node scripts/test-connection.js`, then the app checks from Route A step 4.
7. Pause the old project after a few days of clean running; delete it later.

Freeze writes (or pick a quiet window) between steps 2 and 5, since bookings made on the old project after the dump would be lost.
