-- Stop users RLS helper recursion and allow society members to read maintenance staff.
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
