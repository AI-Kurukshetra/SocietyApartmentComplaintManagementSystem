create extension if not exists pgcrypto;

create table if not exists public.societies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text,
  contact_email text,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.societies (name, slug, city, contact_email)
values ('Demo Society', 'demo-society', 'Bengaluru', 'admin@demo-society.local')
on conflict (slug) do nothing;

create table if not exists public.apartments (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  apartment_number text not null,
  block_name text,
  floor_label text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (society_id, apartment_number)
);

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  society_id uuid not null references public.societies (id) on delete restrict,
  email text not null unique,
  full_name text,
  role text not null default 'resident' check (role in ('resident', 'society_admin', 'maintenance_staff')),
  apartment_id uuid references public.apartments (id) on delete set null,
  apartment_number text,
  phone text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (society_id, apartment_number)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (society_id, name)
);

create table if not exists public.maintenance_staff (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  title text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, service_id)
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  resident_user_id uuid not null references public.users (id) on delete cascade,
  apartment_id uuid not null references public.apartments (id) on delete restrict,
  category_id uuid not null references public.services (id) on delete restrict,
  service_id uuid references public.services (id) on delete restrict,
  assigned_staff_id uuid references public.users (id) on delete set null,
  title text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'on_hold', 'resolved')),
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.staff_categories (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.users (id) on delete cascade,
  category_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (staff_user_id, category_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  comment text not null,
  created_at timestamptz not null default timezone('utc', now())
);


create index if not exists complaints_society_idx on public.complaints (society_id, created_at desc);
create index if not exists complaints_resident_idx on public.complaints (resident_user_id, created_at desc);
create index if not exists complaints_assigned_staff_idx on public.complaints (assigned_staff_id, status);
create index if not exists complaints_category_idx on public.complaints (category_id);
create index if not exists apartments_society_idx on public.apartments (society_id, apartment_number);
create index if not exists services_society_idx on public.services (society_id, name);
create index if not exists users_society_idx on public.users (society_id, role);
create index if not exists maintenance_staff_lookup_idx on public.maintenance_staff (society_id, service_id, is_active);

create index if not exists staff_categories_staff_idx on public.staff_categories (staff_user_id);
create index if not exists staff_categories_category_idx on public.staff_categories (category_id);
create index if not exists comments_complaint_idx on public.comments (complaint_id, created_at desc);

create or replace function public.current_user_society_id()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as 
  select (raw_user_meta_data->>'society_id')::uuid
  from auth.users
  where id = auth.uid();
;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
set row_security = off
as 
  select coalesce((raw_user_meta_data->>'role'), 'resident')
  from auth.users
  where id = auth.uid();
;

create or replace function public.is_society_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as 
  select coalesce(public.current_user_role() = 'society_admin', false);
;

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

  -- Persist society/role in auth.users so RLS helpers can read it without hitting public.users
  if resolved_society_id is not null then
    update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'society_id', resolved_society_id::text,
        'role', requested_role
      )
    where id = new.id;
  end if;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

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

create or replace function public.set_complaint_updated_at()
returns trigger
language plpgsql
as 
begin
  new.updated_at = timezone('utc', now());

  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_at = timezone('utc', now());
  elsif new.status <> 'resolved' then
    new.resolved_at = null;
  end if;

  return new;
end;
;

drop trigger if exists complaints_set_updated_at on public.complaints;
create trigger complaints_set_updated_at
before update on public.complaints
for each row
execute procedure public.set_complaint_updated_at();

alter table public.societies enable row level security;
alter table public.users enable row level security;
alter table public.apartments enable row level security;
alter table public.services enable row level security;
alter table public.maintenance_staff enable row level security;
alter table public.complaints enable row level security;
alter table public.staff_categories enable row level security;
alter table public.comments enable row level security;

drop policy if exists "society members can read their society" on public.societies;
create policy "society members can read their society"
on public.societies
for select
to authenticated
using (id = public.current_user_society_id());

drop policy if exists "public can read societies for signup" on public.societies;
create policy "public can read societies for signup"
on public.societies
for select
to anon
using (true);

drop policy if exists "users can read self or admin can read society users" on public.users;
create policy "users can read self or admin can read society users"
on public.users
for select
to authenticated
using (
  id = auth.uid()
  or (
    public.is_society_admin()
    and society_id = public.current_user_society_id()
  )
  or (
    role = 'maintenance_staff'
    and society_id = public.current_user_society_id()
  )
);

drop policy if exists "users can insert own profile" on public.users;
create policy "users can insert own profile"
on public.users
for insert
to authenticated
with check (id = auth.uid());

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
  id = auth.uid()
  or (
    public.is_society_admin()
    and society_id = public.current_user_society_id()
  )
);

drop policy if exists "society members can read apartments" on public.apartments;
create policy "society members can read apartments"
on public.apartments
for select
to authenticated
using (society_id = public.current_user_society_id());

drop policy if exists "admins can manage apartments" on public.apartments;
create policy "admins can manage apartments"
on public.apartments
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

drop policy if exists "society members can read services" on public.services;
create policy "society members can read services"
on public.services
for select
to authenticated
using (society_id = public.current_user_society_id());

drop policy if exists "admins can manage services" on public.services;
create policy "admins can manage services"
on public.services
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

drop policy if exists "society members can read maintenance staff" on public.maintenance_staff;
create policy "society members can read maintenance staff"
on public.maintenance_staff
for select
to authenticated
using (society_id = public.current_user_society_id());

drop policy if exists "admins can manage maintenance staff" on public.maintenance_staff;
create policy "admins can manage maintenance staff"
on public.maintenance_staff
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

-- staff_categories: allow society-scoped reads, admin manage
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

-- comments: allow participants to read; insert by participants
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


