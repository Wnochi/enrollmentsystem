# CHMSU Enrollment Hub

A responsive React/Vite enrollment system backed by Supabase Auth, PostgreSQL, Storage, Row-Level Security, database transitions, and Realtime.

## Run locally

```bash
npm install
npm run dev
```

Without environment variables, the app runs in local demo mode. Use `student@demo.chmsu.edu.ph` / `Student123!`, or select a staff role and use `Staff123!`.

## Connect the existing Supabase project

1. Audit existing tables and policies. The included migration extends the existing enrollment tables without replacing their data.
2. Review and run `supabase/migrations/202609110001_enrollment_system.sql` in the Supabase SQL editor or with the Supabase CLI. It has already been applied to project `thggxsibajlulkzueeau`.
3. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key. Never put the service-role key in the browser app.
4. In Supabase Authentication, create staff users. Update their corresponding `es_profiles.role` value to `registrar`, `osas`, `guidance`, `medical`, `scholarship`, `cashier`, `ict`, or `admin` from a trusted SQL session.
5. Configure the Site URL and email redirect URLs for sign-up confirmation and password recovery.

The original `Enrollment SYS.zip` is not modified.
