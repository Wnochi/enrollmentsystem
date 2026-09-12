# CHMSU Enrollment Hub

A responsive React/Vite enrollment system backed by Supabase Auth, PostgreSQL, Storage, Row-Level Security, database transitions, and Realtime.

## Run locally

```bash
npm install
npm run dev
```

Without environment variables, the app runs in local demo mode. Use `student@demo.chmsu.edu.ph` / `Student123!`, or select a staff role and use `Staff123!`.

## Connect an existing Supabase project

The migrations are additive and require the existing foundational `public.profiles`, `public.students`, `public.campus`, `public.programs`, `public.academic_terms`, `public.subjects`, `public.enrollments`, `public.payments`, and `public.requirements` tables. They do not recreate production tables.

1. In a trusted SQL session, run `supabase/audits/202609120003_schema_inventory.sql` and save its output as the deployment baseline.
2. Confirm the foundational tables above and their primary/foreign keys match that baseline. On a new local database, restore the captured foundational schema first.
3. Apply every migration in filename order. Existing migration history must be retained; never mark a migration applied without executing it.
4. Apply `202609120003_enrollment_consistency_repair.sql` in one transaction. Its only backfill derives `campus_id` for unconfirmed records with a canonical program campus; ambiguous records are added to `enrollment_academic_reviews`.
5. After commit, the migration asks PostgREST to reload its schema. Run `supabase/audits/202609120004_deployment_check.sql`; do not deploy the app unless it succeeds.
6. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key. Never put the service-role key in the browser app.
7. In Supabase Authentication, create staff users and update their `public.profiles.role` to `registrar`, `osas`, `guidance`, `medical`, `scholarship`, `cashier`, `ict`, or `admin` from a trusted SQL session.
8. Configure the Site URL and email redirect URLs for sign-up confirmation and password recovery.

Run database tests with `supabase test db`, then run `npm run build`. The SQL tests roll back their fixtures.

The original `Enrollment SYS.zip` is not modified.
