-- Adds columns referenced by the application/seed scripts but missing in schema.sql.
-- Safe: does not modify or backfill existing data.

alter table if exists public.apartments
  add column if not exists resident_name text;

alter table if exists public.complaints
  add column if not exists user_id uuid,
  add column if not exists complaint_text text,
  add column if not exists apartment_number text;
