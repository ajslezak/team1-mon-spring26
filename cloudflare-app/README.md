# Amenity Help: Cloudflare/Supabase rewrite

This directory is an isolated replacement for the existing Django app. The
Django implementation remains the source of truth until each feature is ported.

## Local setup

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Set `DATABASE_API` and `PUBLISHABLE_DB_KEY` from Supabase. The app also
   accepts the deployment names `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
3. Run `npm install` and `npm run dev` from this directory.

The repository's `.env.postgres` contains a Postgres connection URL, not the
preferred browser/API project URL. Do not put that connection string into a
frontend bundle. The Pages app expects the HTTPS project URL and publishable key
as separate variables.

## Current scope

The current scaffold provides health, amenity, amenity-type, detail, review,
and favorite endpoints. Run `supabase/application.sql` after `schema.sql` to
enable the user-generated data tables and RLS policies.

Run `supabase/chat.sql` for chat. Then enable Realtime for `public.messages` in
Supabase. The browser can subscribe to inserts on that table; no custom trigger
is required.
