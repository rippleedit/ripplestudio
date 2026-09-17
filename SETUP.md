# RippleStudio Online setup

The app runs with synthetic demo data until the two `VITE_SUPABASE_*` values are set.

## 1. Supabase

Create a separate Supabase project in an EU region. Turn public sign-up off, create the owner account with email and password, then run `supabase/schema.sql` in the SQL editor.

The editor may warn that the SQL contains destructive operations. In this file those operations replace policies, grants and one trigger; they do not delete table data.

Create `local/supabase.env` and `local/migration.env` from the required values. `local/` is gitignored and must never be committed.

## 2. Verify and migrate

Run `npm run verify:anon` before migration. It must report `BLOCKED` for every table.

Run `npm run migrate`. The script opens the old SQLite database read-only, preserves all record IDs and relationships, and prints SQLite vs Supabase counts for every table.

## 3. Frontend

Create `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The publishable key is public by design. Never put a service-role or secret key in `.env`.

## 4. Edge function and schedules

Deploy `supabase/functions/backup/index.ts` with JWT verification disabled. The function verifies its own `BACKUP_TOKEN`. Add `DROPBOX_APP_KEY`, `DROPBOX_REFRESH_TOKEN` and `BACKUP_TOKEN` as Edge Function secrets.

Add `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `BACKUP_TOKEN` as GitHub Actions secrets. The scheduled workflows ping the project twice weekly and export every table to the Dropbox app folder weekly.

## 5. MFA

After authenticator MFA is enrolled and a full login has been tested, run `supabase/enable-mfa-enforcement.sql` to require an AAL2 session for business tables.

