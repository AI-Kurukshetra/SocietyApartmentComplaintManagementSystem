-- Align schema with application queries and stabilize complaint flow.

-- Users: apartment_number support + unique constraint.
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


-- Ensure auth signup trigger writes society/apartment metadata.
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
-- Complaints: ensure resident_user_id + assigned_staff_id + category_id exist.
alter table if exists public.complaints
  add column if not exists resident_user_id uuid,
  add column if not exists assigned_staff_id uuid,
  add column if not exists category_id uuid;

-- Optional service_id column for legacy data.
alter table if exists public.complaints
  add column if not exists service_id uuid;

-- Backfill resident_user_id from legacy user_id if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'complaints'
      AND column_name = 'user_id'
  ) THEN
    UPDATE public.complaints
    SET resident_user_id = user_id
    WHERE resident_user_id IS NULL
      AND user_id IS NOT NULL;
  END IF;
END $$;

-- Backfill category/service ids.
UPDATE public.complaints
SET category_id = service_id
WHERE category_id IS NULL
  AND service_id IS NOT NULL;

UPDATE public.complaints
SET service_id = category_id
WHERE service_id IS NULL
  AND category_id IS NOT NULL;

-- Ensure FK constraints (NOT VALID to avoid blocking existing data).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'complaints_resident_user_id_fkey'
      AND conrelid = 'public.complaints'::regclass
  ) THEN
    ALTER TABLE public.complaints
      ADD CONSTRAINT complaints_resident_user_id_fkey
      FOREIGN KEY (resident_user_id) REFERENCES public.users (id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'complaints_assigned_staff_id_fkey'
      AND conrelid = 'public.complaints'::regclass
  ) THEN
    ALTER TABLE public.complaints
      ADD CONSTRAINT complaints_assigned_staff_id_fkey
      FOREIGN KEY (assigned_staff_id) REFERENCES public.users (id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'complaints_category_id_fkey'
      AND conrelid = 'public.complaints'::regclass
  ) THEN
    ALTER TABLE public.complaints
      ADD CONSTRAINT complaints_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.services (id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

create index if not exists complaints_resident_idx
  on public.complaints (resident_user_id, created_at desc);
create index if not exists complaints_assigned_staff_idx
  on public.complaints (assigned_staff_id, status);
create index if not exists complaints_category_idx
  on public.complaints (category_id);

-- Staff categories table (service -> staff mapping).
create table if not exists public.staff_categories (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.users (id) on delete cascade,
  category_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (staff_user_id, category_id)
);

create index if not exists staff_categories_staff_idx
  on public.staff_categories (staff_user_id);
create index if not exists staff_categories_category_idx
  on public.staff_categories (category_id);

-- Comments table for complaint threads.
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  comment text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists comments_complaint_idx
  on public.comments (complaint_id, created_at desc);

-- Backfill apartments from users with apartment_number.
insert into public.apartments (society_id, apartment_number)
select distinct u.society_id, u.apartment_number
from public.users u
where u.apartment_number is not null
on conflict (society_id, apartment_number) do nothing;

update public.users u
set apartment_id = a.id
from public.apartments a
where u.apartment_id is null
  and u.apartment_number is not null
  and a.society_id = u.society_id
  and a.apartment_number = u.apartment_number;

update public.users u
set apartment_number = a.apartment_number
from public.apartments a
where u.apartment_number is null
  and u.apartment_id = a.id;

-- Update complaint assignment trigger to use category_id and assigned_staff_id.
create or replace function public.assign_maintenance_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as 
declare
  resident_society_id uuid;
begin
  select society_id
  into resident_society_id
  from public.users
  where id = new.resident_user_id;

  if resident_society_id is null then
    raise exception 'Resident profile not found for complaint.';
  end if;

  new.society_id := resident_society_id;

  if new.category_id is null and new.service_id is not null then
    new.category_id := new.service_id;
  elsif new.service_id is null and new.category_id is not null then
    new.service_id := new.category_id;
  end if;

  if new.category_id is null then
    raise exception 'Category is required for complaints.';
  end if;

  if not exists (
    select 1
    from public.apartments
    where id = new.apartment_id
      and society_id = resident_society_id
  ) then
    raise exception 'Apartment does not belong to the resident society.';
  end if;

  if not exists (
    select 1
    from public.services
    where id = new.category_id
      and society_id = resident_society_id
      and is_active = true
  ) then
    raise exception 'Category does not belong to the resident society or is inactive.';
  end if;

  if new.assigned_staff_id is null then
    raise exception 'Assigned staff is required.';
  end if;

  if not exists (
    select 1
    from public.users u
    where u.id = new.assigned_staff_id
      and u.role = 'maintenance_staff'
      and u.society_id = resident_society_id
  ) then
    raise exception 'Assigned staff must be a maintenance user in the resident society.';
  end if;

  return new;
end;
;

drop trigger if exists complaints_assign_maintenance_staff on public.complaints;
create trigger complaints_assign_maintenance_staff
before insert on public.complaints
for each row
execute procedure public.assign_maintenance_staff();

-- RLS: enable and align policies.
alter table public.staff_categories enable row level security;
alter table public.comments enable row level security;

-- Complaints policies
drop policy if exists "residents can read own complaints" on public.complaints;
create policy "residents can read own complaints"
on public.complaints
for select
to authenticated
using (resident_user_id = auth.uid());

drop policy if exists "staff can read assigned complaints" on public.complaints;
create policy "staff can read assigned complaints"
on public.complaints
for select
to authenticated
using (assigned_staff_id = auth.uid());

drop policy if exists "admins can read society complaints" on public.complaints;
create policy "admins can read society complaints"
on public.complaints
for select
to authenticated
using (
  public.is_society_admin()
  and society_id = public.current_user_society_id()
);

drop policy if exists "residents can create complaints" on public.complaints;
create policy "residents can create complaints"
on public.complaints
for insert
to authenticated
with check (
  resident_user_id = auth.uid()
  and society_id = public.current_user_society_id()
  and assigned_staff_id in (
    select u.id
    from public.users u
    where u.role = 'maintenance_staff'
      and u.society_id = public.current_user_society_id()
  )
);

drop policy if exists "admins can manage complaints" on public.complaints;
create policy "admins can manage complaints"
on public.complaints
for all
to authenticated
using (
  public.is_society_admin()
  and society_id = public.current_user_society_id()
)
with check (
  public.is_society_admin()
  and society_id = public.current_user_society_id()
);

drop policy if exists "staff can update assigned complaints" on public.complaints;
create policy "staff can update assigned complaints"
on public.complaints
for update
to authenticated
using (assigned_staff_id = auth.uid())
with check (assigned_staff_id = auth.uid());

-- staff_categories policies
drop policy if exists "society members can read staff categories" on public.staff_categories;
create policy "society members can read staff categories"
on public.staff_categories
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = staff_user_id
      and u.society_id = public.current_user_society_id()
  )
  and exists (
    select 1
    from public.services s
    where s.id = category_id
      and s.society_id = public.current_user_society_id()
  )
);

drop policy if exists "admins can manage staff categories" on public.staff_categories;
create policy "admins can manage staff categories"
on public.staff_categories
for all
to authenticated
using (public.is_society_admin())
with check (
  public.is_society_admin()
  and exists (
    select 1
    from public.users u
    where u.id = staff_user_id
      and u.society_id = public.current_user_society_id()
  )
  and exists (
    select 1
    from public.services s
    where s.id = category_id
      and s.society_id = public.current_user_society_id()
  )
);

-- comments policies
drop policy if exists "participants can read comments" on public.comments;
create policy "participants can read comments"
on public.comments
for select
to authenticated
using (
  exists (
    select 1
    from public.complaints c
    where c.id = complaint_id
      and (
        c.resident_user_id = auth.uid()
        or c.assigned_staff_id = auth.uid()
        or (
          public.is_society_admin()
          and c.society_id = public.current_user_society_id()
        )
      )
  )
);

drop policy if exists "participants can add comments" on public.comments;
create policy "participants can add comments"
on public.comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.complaints c
    where c.id = complaint_id
      and (
        c.resident_user_id = auth.uid()
        or c.assigned_staff_id = auth.uid()
        or (
          public.is_society_admin()
          and c.society_id = public.current_user_society_id()
        )
      )
  )
);

-- Allow unauthenticated users to resolve societies by slug for signup.
drop policy if exists "public can read societies for signup" on public.societies;
create policy "public can read societies for signup"
on public.societies
for select
to anon
using (true);
