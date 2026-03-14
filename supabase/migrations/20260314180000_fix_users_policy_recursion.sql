-- Fix RLS recursion on users policies by running helper functions with row_security off
create or replace function public.current_user_society_id()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as 
  select society_id
  from public.users
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
  select role
  from public.users
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
