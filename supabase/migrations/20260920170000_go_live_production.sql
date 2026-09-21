-- Phase 8: Go-live production connection hardening
-- Storage RLS, secure QR resolve, customer-only order projection (no finance leak).

-- ---------------------------------------------------------------------------
-- 1) Customer order projection (no laundry cost / commission / contribution / margin)
-- ---------------------------------------------------------------------------
create or replace view public.customer_orders
with (security_invoker = false)
as
select
  o.id,
  o.order_number,
  o.invoice_number,
  o.customer_id,
  o.status,
  o.preferred_language,
  o.pickup_address_id,
  o.delivery_address_id,
  o.pickup_slot_id,
  o.scheduled_pickup_at,
  o.scheduled_delivery_at,
  o.piece_count,
  o.estimated_piece_count,
  o.confirmed_piece_count,
  o.subtotal_omr,
  o.discount_omr,
  o.delivery_fee_omr,
  o.vat_rate,
  o.vat_omr,
  o.total_omr,
  o.currency_code,
  o.payment_method,
  o.payment_status,
  o.customer_notes,
  o.created_at,
  o.updated_at,
  o.delivered_at,
  o.cancelled_at
from public.orders o
where o.customer_id = private.current_customer_id();

comment on view public.customer_orders is
  'Customer-safe order projection: customer prices only — no partner cost, commission, packaging, contribution, or margin.';

revoke all on public.customer_orders from anon;
grant select on public.customer_orders to authenticated;

create or replace view public.customer_order_items
with (security_invoker = false)
as
select
  i.id,
  i.order_id,
  i.service_id,
  i.service_code,
  i.service_name_en,
  i.service_name_ar,
  i.quantity,
  i.estimated_quantity,
  i.confirmed_quantity,
  i.unit_price_omr,
  i.line_total_omr,
  i.created_at,
  i.updated_at
from public.order_items i
inner join public.orders o on o.id = i.order_id
where o.customer_id = private.current_customer_id();

comment on view public.customer_order_items is
  'Customer-safe line items: unit/line customer prices only (no partner_unit_cost / partner_line_cost).';

revoke all on public.customer_order_items from anon;
grant select on public.customer_order_items to authenticated;

-- Ownership helpers (security definer) so related-table RLS still works
-- after customers lose direct SELECT on public.orders.
create or replace function private.customer_owns_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and o.customer_id = private.current_customer_id()
  );
$$;

create or replace function private.driver_assigned_to_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and (
        o.pickup_driver_id = private.current_driver_id()
        or o.delivery_driver_id = private.current_driver_id()
      )
  );
$$;

revoke all on function private.customer_owns_order(uuid) from public;
revoke all on function private.driver_assigned_to_order(uuid) from public;
grant execute on function private.customer_owns_order(uuid) to authenticated;
grant execute on function private.driver_assigned_to_order(uuid) to authenticated;

-- Customers no longer SELECT base orders / order_items (finance columns unreachable)
drop policy if exists "orders_select_own_driver_or_staff" on public.orders;
drop policy if exists "orders_select_driver_or_staff" on public.orders;
create policy "orders_select_driver_or_staff"
  on public.orders for select to authenticated
  using (
    private.is_staff()
    or pickup_driver_id = private.current_driver_id()
    or delivery_driver_id = private.current_driver_id()
  );

drop policy if exists "order_items_select_via_order" on public.order_items;
drop policy if exists "order_items_select_driver_or_staff" on public.order_items;
create policy "order_items_select_driver_or_staff"
  on public.order_items for select to authenticated
  using (
    private.is_staff()
    or private.driver_assigned_to_order(order_items.order_id)
  );

-- Related tables: use helpers instead of nested SELECT on orders
drop policy if exists "order_status_history_select" on public.order_status_history;
create policy "order_status_history_select"
  on public.order_status_history for select to authenticated
  using (
    private.is_staff()
    or private.customer_owns_order(order_id)
    or private.driver_assigned_to_order(order_id)
  );

drop policy if exists "order_photos_select" on public.order_photos;
create policy "order_photos_select"
  on public.order_photos for select to authenticated
  using (
    private.is_staff()
    or private.customer_owns_order(order_id)
    or private.driver_assigned_to_order(order_id)
  );

drop policy if exists "payments_select" on public.payments;
create policy "payments_select"
  on public.payments for select to authenticated
  using (
    private.is_finance_or_admin()
    or private.customer_owns_order(order_id)
    or private.driver_assigned_to_order(order_id)
  );

drop policy if exists "order_status_history_insert" on public.order_status_history;
create policy "order_status_history_insert"
  on public.order_status_history for insert to authenticated
  with check (
    private.is_staff()
    or private.driver_assigned_to_order(order_id)
    or (
      private.customer_owns_order(order_id)
      and to_status = 'pending'
      and from_status is null
    )
  );

drop policy if exists "payments_write_finance_or_driver" on public.payments;
drop policy if exists "payments_write_finance_driver_or_customer" on public.payments;
create policy "payments_write_finance_driver_or_customer"
  on public.payments for insert to authenticated
  with check (
    private.is_finance_or_admin()
    or collected_by_driver_id = private.current_driver_id()
    or (
      status = 'unpaid'
      and private.customer_owns_order(order_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Secure QR resolution (opaque token → order id for authorized roles only)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_order_qr(p_token text)
returns table (
  order_id uuid,
  viewer text
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_order public.orders%rowtype;
  v_viewer text;
begin
  if p_token is null or length(trim(p_token)) < 32 then
    return;
  end if;

  if auth.uid() is null then
    return;
  end if;

  select * into v_order
  from public.orders o
  where o.qr_token = p_token
  limit 1;

  if not found then
    return;
  end if;

  if private.is_staff() then
    v_viewer := 'staff';
  elsif v_order.pickup_driver_id = private.current_driver_id()
     or v_order.delivery_driver_id = private.current_driver_id() then
    v_viewer := 'driver';
  elsif v_order.customer_id = private.current_customer_id() then
    v_viewer := 'customer';
  else
    return;
  end if;

  order_id := v_order.id;
  viewer := v_viewer;
  return next;
end;
$$;

revoke all on function public.resolve_order_qr(text) from public;
grant execute on function public.resolve_order_qr(text) to authenticated;

comment on function public.resolve_order_qr(text) is
  'Resolves opaque QR token to order id for owning customer, assigned driver, or staff. Returns no financial fields. Anon gets nothing.';

-- ---------------------------------------------------------------------------
-- 3) Storage bucket + path policies for order photos
-- Path convention: order-photos/{order_id}/{filename}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-photos',
  'order-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_access_order_photo_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_order_id uuid;
begin
  begin
    v_order_id := nullif(split_part(object_name, '/', 1), '')::uuid;
  exception when others then
    return false;
  end;

  if v_order_id is null then
    return false;
  end if;

  if private.is_staff() then
    return true;
  end if;

  return private.customer_owns_order(v_order_id)
    or private.driver_assigned_to_order(v_order_id);
end;
$$;

drop policy if exists "order_photos_storage_select" on storage.objects;
create policy "order_photos_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'order-photos'
    and private.can_access_order_photo_path(name)
  );

drop policy if exists "order_photos_storage_insert" on storage.objects;
create policy "order_photos_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'order-photos'
    and private.can_access_order_photo_path(name)
    and (
      private.is_staff()
      or private.current_driver_id() is not null
      or private.current_customer_id() is not null
    )
  );

drop policy if exists "order_photos_storage_update" on storage.objects;
create policy "order_photos_storage_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'order-photos'
    and private.is_staff()
  )
  with check (
    bucket_id = 'order-photos'
    and private.is_staff()
  );

drop policy if exists "order_photos_storage_delete" on storage.objects;
create policy "order_photos_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'order-photos'
    and private.is_staff()
  );

comment on table public.order_photos is
  'Photo metadata. Files live in private storage bucket order-photos/{order_id}/… with RLS.';
