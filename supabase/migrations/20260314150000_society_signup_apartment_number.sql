-- Add apartment_number to users and enforce unique per society.

alter table if exists public.users
  add column if not exists apartment_number text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_society_apartment_number_key'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_society_apartment_number_key UNIQUE (society_id, apartment_number);
  END IF;
END $$;

-- Update user bootstrap to persist society + apartment number and create apartment rows.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as 
declare
  requested_society_id uuid;
  fallback_society_id uuid;
  resolved_society_id uuid;
  requested_role text;
  requested_apartment_number text;
  resolved_apartment_id uuid;
begin
  begin
    requested_society_id := nullif(new.raw_user_meta_data ->> 'society_id', '')::uuid;
  exception
    when others then
      requested_society_id := null;
  end;

  requested_apartment_number := nullif(btrim(new.raw_user_meta_data ->> 'apartment_number'), '');

  select id
  into fallback_society_id
  from public.societies
  order by created_at asc
  limit 1;

  resolved_society_id := coalesce(requested_society_id, fallback_society_id);

  requested_role := case
    when new.raw_user_meta_data ->> 'role' in ('resident', 'society_admin', 'maintenance_staff')
      then new.raw_user_meta_data ->> 'role'
    else 'resident'
  end;

  if requested_apartment_number is not null and resolved_society_id is not null then
    insert into public.apartments (society_id, apartment_number)
    values (resolved_society_id, requested_apartment_number)
    on conflict (society_id, apartment_number) do update
      set apartment_number = excluded.apartment_number
    returning id
    into resolved_apartment_id;
  end if;

  insert into public.users (id, society_id, email, full_name, role, apartment_id, apartment_number)
  values (
    new.id,
    resolved_society_id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    requested_role,
    resolved_apartment_id,
    requested_apartment_number
  )
  on conflict (id) do update
  set society_id = excluded.society_id,
      email = excluded.email,
      full_name = coalesce(excluded.full_name, public.users.full_name),
      role = excluded.role,
      apartment_id = coalesce(excluded.apartment_id, public.users.apartment_id),
      apartment_number = coalesce(excluded.apartment_number, public.users.apartment_number);

  return new;
end;
;

-- Prevent residents from changing apartment_number after signup.
drop policy if exists "users can update self or admin can manage society users" on public.users;
create policy "users can update self or admin can manage society users"
on public.users
for update
to authenticated
using (
  id = auth.uid()
  or (
    public.is_society_admin()
    and society_id = public.current_user_society_id()
  )
)
with check (
  (
    id = auth.uid()
    and society_id = public.current_user_society_id()
    and apartment_number = (
      select u.apartment_number
      from public.users u
      where u.id = auth.uid()
    )
  )
  or (
    public.is_society_admin()
    and society_id = public.current_user_society_id()
  )
);

-- Allow unauthenticated users to resolve societies by slug for signup.
drop policy if exists "public can read societies for signup" on public.societies;
create policy "public can read societies for signup"
on public.societies
for select
to anon
using (true);
