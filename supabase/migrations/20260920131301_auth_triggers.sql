-- Auth helpers + profile bootstrap.
-- Authorization MUST use app_metadata / profiles.role — never user_metadata.

create or replace function private.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.role
      from public.profiles p
      where p.id = auth.uid()
    ),
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', '')::public.app_role,
    'customer'::public.app_role
  );
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.current_role() in ('admin', 'manager', 'finance');
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.current_role() = 'admin';
$$;

create or replace function private.is_finance_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.current_role() in ('admin', 'finance', 'manager');
$$;

create or replace function private.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.customers c
  where c.profile_id = auth.uid()
  limit 1;
$$;

create or replace function private.current_driver_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.id
  from public.drivers d
  where d.profile_id = auth.uid()
  limit 1;
$$;

revoke all on function private.current_role() from public;
revoke all on function private.is_staff() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_finance_or_admin() from public;
revoke all on function private.current_customer_id() from public;
revoke all on function private.current_driver_id() from public;

grant execute on function private.current_role() to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_finance_or_admin() to authenticated;
grant execute on function private.current_customer_id() to authenticated;
grant execute on function private.current_driver_id() to authenticated;

-- Keep auth.users app_metadata.role in sync with profiles.role (safe for JWT checks).
create or replace function private.sync_role_to_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new.role::text)
  where id = new.id;
  return new;
end;
$$;

create trigger profiles_sync_role_to_auth
after insert or update of role on public.profiles
for each row execute function private.sync_role_to_auth();

-- Auto-create profile (+ customer/driver row) on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_role public.app_role := 'customer';
  meta_role text;
begin
  meta_role := coalesce(
    new.raw_app_meta_data ->> 'role',
    new.raw_user_meta_data ->> 'role'
  );

  if meta_role in ('customer', 'driver', 'admin', 'manager', 'finance') then
    -- Only allow elevated roles when already stamped in app_metadata by service role.
    if meta_role in ('admin', 'manager', 'finance', 'driver')
       and coalesce(new.raw_app_meta_data ->> 'role', '') = meta_role then
      chosen_role := meta_role::public.app_role;
    elsif meta_role = 'customer' then
      chosen_role := 'customer';
    else
      chosen_role := 'customer';
    end if;
  end if;

  insert into public.profiles (id, full_name, phone, email, role, preferred_language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone'),
    new.email,
    chosen_role,
    coalesce((new.raw_user_meta_data ->> 'preferred_language')::public.preferred_language, 'ar')
  )
  on conflict (id) do nothing;

  if chosen_role = 'customer' then
    insert into public.customers (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing;
  elsif chosen_role = 'driver' then
    insert into public.drivers (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Prevent non-admins from changing their own role via direct updates.
create or replace function private.enforce_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- auth.uid() is null for service_role / SQL migrations
    if auth.uid() is not null and not private.is_admin() then
      raise exception 'Only admin can change profile role';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_role_change
before update of role on public.profiles
for each row execute function private.enforce_profile_role_change();

-- Public wrappers for clients that need role checks in app code (not for RLS bypass).
create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select private.current_role();
$$;

grant execute on function public.current_user_role() to authenticated;
