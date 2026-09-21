-- Create / promote the first GHASILAK admin (run in Supabase SQL Editor).
-- SAFE: no passwords here. Create the Auth user in the Dashboard first, then paste their UUID.
--
-- Steps:
-- 1) Authentication → Users → Add user (email + your own strong password)
-- 2) Copy that user's UUID
-- 3) Replace EVERY 'PASTE_USER_UUID_HERE' below and run this script
-- 4) Sign in at /ar/admin/login

-- Optional: look up UUID by email (uncomment and set email)
-- select id, email from auth.users where email = 'you@example.com';

update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where id = 'PASTE_USER_UUID_HERE';

update public.profiles
set role = 'admin'
where id = 'PASTE_USER_UUID_HERE';

-- Verify
select id, email, raw_app_meta_data->>'role' as app_role
from auth.users
where id = 'PASTE_USER_UUID_HERE';

select id, full_name, role from public.profiles where id = 'PASTE_USER_UUID_HERE';
