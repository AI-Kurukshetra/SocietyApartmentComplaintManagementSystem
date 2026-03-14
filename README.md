# Society Complaint Management System

A full-stack resident complaint portal built with Next.js 14 App Router, Supabase, TypeScript, Tailwind CSS, and npm. Residents can sign up, log in, submit complaints, and review their own complaint history. Admin accounts can review every complaint and update complaint status from the dashboard.

This project was built using Codex CLI as the AI coding assistant.

## Features

- Next.js 14 with the App Router
- Supabase authentication with signup, login, logout, and session persistence
- Role-aware dashboard for residents and admins
- Complaint submission form with apartment suggestions
- SQL schema for `users`, `apartments`, and `complaints`
- Seed script for sample apartments, users, and complaints
- Deployment-ready structure for Vercel

## Tech Stack

- Next.js 14
- Supabase
- TypeScript
- Tailwind CSS
- npm
- Vercel

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in the Supabase values inside `.env.local`.

4. Run the SQL schema in your Supabase project:

   - Open the Supabase SQL Editor.
   - Paste the contents of `supabase/schema.sql`.
   - Execute the script.

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000`.

## Environment Variables

Required for the app:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Optional, but required for the seed script:

```env
SUPABASE_SERVICE_ROLE_KEY=
```

## Supabase Setup

1. Create a new Supabase project.
2. In Project Settings, copy:
   - Project URL into `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable anon key into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Copy the service role key into `SUPABASE_SERVICE_ROLE_KEY` if you want to run the seed script.
4. Run `supabase/schema.sql` in the SQL Editor.
5. In Authentication settings, decide whether email confirmation is required:
   - If disabled, signup logs the user straight into the app.
   - If enabled, signup succeeds and users confirm their email before logging in.

## Database Design

The schema creates:

- `users`: application profiles linked to `auth.users`
- `apartments`: flat and resident assignment data
- `complaints`: resident complaints with status tracking

The SQL also includes:

- a trigger that creates a `users` row when a new auth user signs up
- row-level security policies
- an admin helper function
- an `updated_at` trigger for complaints

## Seed Data

Run the seed script after the schema has been applied and `.env.local` contains the service role key:

```bash
npm run seed
```

The script inserts:

- sample apartments
- an admin user: `admin@society.local`
- a resident user: `resident@society.local`
- sample complaints

Seed passwords are set inside `scripts/seed.mjs` and can be changed before running the script.

## Deploying to Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Import the project into Vercel.
3. Add these environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Deploy.

If you want to run the seed script outside local development, keep `SUPABASE_SERVICE_ROLE_KEY` out of the client bundle and only use it in secure server-side environments.

## Project Structure

```text
app/
  dashboard/
  login/
  signup/
  submit-complaint/
components/
  auth/
  complaints/
  layout/
  providers/
lib/
  supabaseClient.ts
  types.ts
scripts/
  seed.mjs
supabase/
  schema.sql
```
