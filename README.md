# CHMSU Enrollment System

CHMSU Enrollment Hub is a React and Vite web portal for student enrollment and multi-office processing at Carlos Hilado Memorial State University.

## Features

- Student registration, sign-in, password recovery, and saved enrollment progress
- Academic selection for campus, program, term, student type, and year level
- Document uploads, assessment and insurance payment proof, office clearances, and school ID processing
- Registrar, OSAS, Guidance, Medical, Scholarship, Cashier, ICT, and Admin workspaces
- Subject-section assignment with capacity and schedule-conflict checks
- Supabase Auth, PostgreSQL, Storage, Row-Level Security, RPC transitions, and Realtime updates
- Local demo mode when Supabase credentials are not configured

## Requirements

- Node.js 18 or newer
- npm
- A Supabase project for connected mode

## Run locally

From the repository root:

```bash
npm install
npm run dev
```

The development server uses port `8443` by default. Use `npm run build` to create a production build and `npm run preview` to serve it locally.

## Demo mode

If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are missing, the app runs without a backend and stores demo data in browser `localStorage`.

Student account:

```text
Email:    student@demo.chmsu.edu.ph
Password: Student123!
```

Staff accounts use the role name as the email prefix and `Staff123!` as the password:

```text
registrar@demo.chmsu.edu.ph
osas@demo.chmsu.edu.ph
guidance@demo.chmsu.edu.ph
medical@demo.chmsu.edu.ph
scholarship@demo.chmsu.edu.ph
cashier@demo.chmsu.edu.ph
ict@demo.chmsu.edu.ph
admin@demo.chmsu.edu.ph
```

## Supabase setup

1. Create a `.env.local` file in `enrollment-system-app` with the browser-safe project URL and publishable/anonymous key:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
   ```

2. Apply the SQL migrations in `enrollment-system-app/supabase/migrations` in filename order.
3. Create staff users in Supabase Authentication.
4. Set each staff user’s `profiles.role` to one of `registrar`, `osas`, `guidance`, `medical`, `scholarship`, `cashier`, `ict`, or `admin` from a trusted SQL session.
5. Configure the Supabase Site URL and authentication redirect URLs for email confirmation and password recovery.

Never expose a Supabase service-role key in this browser application. The frontend reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; variables with other prefixes are ignored.

## Project structure

```text
.
├── package.json                 # Root npm workspace scripts
├── src/App.tsx                  # Re-export for the root workspace entry
└── enrollment-system-app/
    ├── src/App.tsx              # Main application
    ├── src/components/          # Enrollment and dashboard UI
    ├── src/lib/system.ts        # Auth, demo mode, Supabase data access
    └── supabase/migrations/     # Database schema, policies, and RPCs
```

## Available scripts

```bash
npm run dev       # Start Vite in development mode
npm run build     # Build for production
npm run preview   # Preview the production build
npm run format    # Format the app with oxfmt
```

