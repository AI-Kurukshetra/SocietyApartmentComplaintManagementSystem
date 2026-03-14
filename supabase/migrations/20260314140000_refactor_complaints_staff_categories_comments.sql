-- Refactor complaint assignment to staff users and add staff_categories + comments.

-- 1) Complaints: add assigned_staff_id (users.id)
alter table if exists public.complaints
  add column if not exists assigned_staff_id uuid;

-- Backfill from maintenance_staff mapping if available
update public.complaints c
set assigned_staff_id = ms.user_id
from public.maintenance_staff ms
where c.assigned_staff_id is null
  and c.assigned_maintenance_staff_id = ms.id;

-- FK (not valid to avoid failing on existing rows)
DO $$
BEGIN
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
END $$;

create index if not exists complaints_assigned_staff_idx
  on public.complaints (assigned_staff_id, status);

-- 2) staff_categories mapping table
create table if not exists public.staff_categories (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.users (id) on delete cascade,
  category_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (staff_user_id, category_id)
);

create index if not exists staff_categories_staff_idx on public.staff_categories (staff_user_id);
create index if not exists staff_categories_category_idx on public.staff_categories (category_id);

-- 3) comments table
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  comment text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists comments_complaint_idx on public.comments (complaint_id, created_at desc);

-- 4) Update complaint assignment trigger to validate assigned_staff_id
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
    where id = new.service_id
      and society_id = resident_society_id
      and is_active = true
  ) then
    raise exception 'Service does not belong to the resident society or is inactive.';
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

-- 5) RLS policies
alter table public.comments enable row level security;
alter table public.staff_categories enable row level security;

-- Complaints: replace select/insert/update policies
drop policy if exists "society members can read complaints in their society" on public.complaints;
drop policy if exists "users can create complaints for their society" on public.complaints;
drop policy if exists "admins and assigned maintenance can update complaints" on public.complaints;

create policy "residents can read own complaints"
on public.complaints
for select
to authenticated
using (resident_user_id = auth.uid());

create policy "staff can read assigned complaints"
on public.complaints
for select
to authenticated
using (assigned_staff_id = auth.uid());

create policy "admins can read society complaints"
on public.complaints
for select
to authenticated
using (
  public.is_society_admin()
  and society_id = public.current_user_society_id()
);

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

create policy "staff can update assigned complaints"
on public.complaints
for update
to authenticated
using (assigned_staff_id = auth.uid())
with check (assigned_staff_id = auth.uid());

-- staff_categories: allow society-scoped reads, admin manage
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

-- comments: allow participants to read; insert by participants
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
