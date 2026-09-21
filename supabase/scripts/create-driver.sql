-- Promote an existing Auth user to driver and ensure a drivers row exists.
-- Create the Auth user in the Dashboard first (no passwords in this file).
-- Replace PASTE_USER_UUID_HERE, then run in SQL Editor.

update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"driver"}'::jsonb
where id = 'PASTE_USER_UUID_HERE';

update public.profiles
set role = 'driver'
where id = 'PASTE_USER_UUID_HERE';

insert into public.drivers (profile_id, status, is_available)
select 'PASTE_USER_UUID_HERE', 'active', true
where not exists (
  select 1 from public.drivers d where d.profile_id = 'PASTE_USER_UUID_HERE'
);

select d.id as driver_id, p.role, u.email
from public.drivers d
join public.profiles p on p.id = d.profile_id
join auth.users u on u.id = d.profile_id
where d.profile_id = 'PASTE_USER_UUID_HERE';
