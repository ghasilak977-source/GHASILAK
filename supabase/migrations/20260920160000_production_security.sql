-- Phase 7: Production security — freeze financial snapshots, fix place-order side writes,
-- driver-safe customer contact via security-definer projection.

-- ---------------------------------------------------------------------------
-- Financial column freeze on orders (customers/drivers cannot rewrite money)
-- ---------------------------------------------------------------------------
create or replace function private.orders_protect_financial_columns()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  staff boolean := private.is_staff();
begin
  if staff then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.subtotal_omr is distinct from old.subtotal_omr
      or new.discount_omr is distinct from old.discount_omr
      or new.delivery_fee_omr is distinct from old.delivery_fee_omr
      or new.vat_rate is distinct from old.vat_rate
      or new.vat_omr is distinct from old.vat_omr
      or new.total_omr is distinct from old.total_omr
      or new.partner_cost_total_omr is distinct from old.partner_cost_total_omr
      or new.driver_commission_percent is distinct from old.driver_commission_percent
      or new.driver_commission_omr is distinct from old.driver_commission_omr
      or new.packaging_cost_omr is distinct from old.packaging_cost_omr
      or new.other_direct_cost_omr is distinct from old.other_direct_cost_omr
      or new.contribution_omr is distinct from old.contribution_omr
      or new.margin_percentage is distinct from old.margin_percentage
      or new.promo_code_id is distinct from old.promo_code_id
    then
      raise exception 'Financial snapshot columns are immutable for non-staff roles'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_protect_financial_columns on public.orders;
create trigger orders_protect_financial_columns
  before update on public.orders
  for each row
  execute function private.orders_protect_financial_columns();

-- ---------------------------------------------------------------------------
-- Financial freeze on order_items (unit prices / partner costs)
-- ---------------------------------------------------------------------------
create or replace function private.order_items_protect_financial_columns()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if private.is_staff() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.unit_price_omr is distinct from old.unit_price_omr
      or new.partner_unit_cost_omr is distinct from old.partner_unit_cost_omr
      or new.line_total_omr is distinct from old.line_total_omr
      or new.partner_line_cost_omr is distinct from old.partner_line_cost_omr
      or new.service_code is distinct from old.service_code
    then
      raise exception 'Order item financial columns are immutable for non-staff roles'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists order_items_protect_financial_columns on public.order_items;
create trigger order_items_protect_financial_columns
  before update on public.order_items
  for each row
  execute function private.order_items_protect_financial_columns();

-- ---------------------------------------------------------------------------
-- Customer may insert initial unpaid payment + status history for own orders
-- (server-side place-order preferred; these policies cover legitimate paths)
-- ---------------------------------------------------------------------------
drop policy if exists "order_status_history_insert" on public.order_status_history;
create policy "order_status_history_insert"
  on public.order_status_history for insert to authenticated
  with check (
    private.is_staff()
    or exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and (
          o.pickup_driver_id = private.current_driver_id()
          or o.delivery_driver_id = private.current_driver_id()
        )
    )
    or (
      -- Customer: only initial pending row for own order
      exists (
        select 1 from public.orders o
        where o.id = order_status_history.order_id
          and o.customer_id = private.current_customer_id()
      )
      and to_status = 'pending'
      and from_status is null
    )
  );

drop policy if exists "payments_write_finance_or_driver" on public.payments;
create policy "payments_write_finance_driver_or_customer"
  on public.payments for insert to authenticated
  with check (
    private.is_finance_or_admin()
    or collected_by_driver_id = private.current_driver_id()
    or (
      status = 'unpaid'
      and exists (
        select 1 from public.orders o
        where o.id = payments.order_id
          and o.customer_id = private.current_customer_id()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Driver order cards: security definer so assigned drivers see customer name/phone
-- without broad profiles SELECT. Still excludes laundry cost / margin / profit.
-- ---------------------------------------------------------------------------
create or replace view public.driver_order_cards
with (security_invoker = false)
as
select
  o.id,
  o.order_number,
  o.status,
  o.pickup_driver_id,
  o.delivery_driver_id,
  o.scheduled_pickup_at,
  o.scheduled_delivery_at,
  o.pickup_slot_id,
  o.estimated_piece_count,
  o.piece_count,
  o.customer_notes,
  o.pickup_notes,
  o.delivery_notes,
  o.payment_method,
  o.payment_status,
  o.cash_collected_omr,
  o.cash_collected_at,
  o.cash_collected_by_driver_id,
  o.arrived_at_pickup_at,
  o.arrived_at_delivery_at,
  o.delivery_confirmation_code,
  o.qr_token,
  o.qr_scanned_at_pickup,
  o.qr_scanned_at_delivery,
  o.driver_commission_percent,
  o.driver_commission_omr,
  greatest(o.subtotal_omr - o.discount_omr, 0)::numeric(12, 3) as eligible_revenue_omr,
  o.total_omr as customer_total_omr,
  o.created_at,
  o.updated_at,
  a.area_code,
  a.area_name_en,
  a.area_name_ar,
  a.street,
  a.building,
  a.unit,
  a.landmark,
  a.latitude,
  a.longitude,
  a.notes as address_notes,
  p.full_name as customer_name,
  p.phone as customer_phone
from public.orders o
left join public.addresses a on a.id = coalesce(o.pickup_address_id, o.delivery_address_id)
left join public.customers c on c.id = o.customer_id
left join public.profiles p on p.id = c.profile_id
where
  o.pickup_driver_id = private.current_driver_id()
  or o.delivery_driver_id = private.current_driver_id()
  or private.is_staff();

comment on view public.driver_order_cards is
  'Driver-safe order projection (security definer): contact + commission only; no laundry/margin.';

revoke all on public.driver_order_cards from anon;
grant select on public.driver_order_cards to authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket placeholder note (policies deferred until photo upload ships)
-- ---------------------------------------------------------------------------
comment on table public.order_photos is
  'Photo metadata only. Do not enable Storage uploads in production until bucket RLS path policies exist.';

-- ---------------------------------------------------------------------------
-- Customers must not insert orders/items directly (forged snapshots).
-- Place-order goes through a server action using the service role.
-- ---------------------------------------------------------------------------
drop policy if exists "orders_insert_customer_or_staff" on public.orders;
create policy "orders_insert_staff_only"
  on public.orders for insert to authenticated
  with check (private.is_staff());

drop policy if exists "order_items_write_customer_or_staff" on public.order_items;
create policy "order_items_write_staff_only"
  on public.order_items for insert to authenticated
  with check (private.is_staff());
