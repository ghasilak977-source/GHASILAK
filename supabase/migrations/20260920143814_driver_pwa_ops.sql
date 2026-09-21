-- Phase 4: Driver PWA operational fields, cash held tracking, handover statuses, delivery codes.

alter type public.cash_handover_status add value if not exists 'submitted';
alter type public.cash_handover_status add value if not exists 'rejected';

alter table public.orders
  add column if not exists delivery_confirmation_code text,
  add column if not exists cash_collected_omr numeric(12, 3) not null default 0
    check (cash_collected_omr >= 0),
  add column if not exists cash_collected_at timestamptz,
  add column if not exists cash_collected_by_driver_id uuid
    references public.drivers (id) on delete set null,
  add column if not exists arrived_at_pickup_at timestamptz,
  add column if not exists arrived_at_delivery_at timestamptz,
  add column if not exists pickup_notes text,
  add column if not exists delivery_notes text,
  add column if not exists pickup_photo_path text,
  add column if not exists delivery_photo_path text,
  add column if not exists qr_scanned_at_pickup timestamptz,
  add column if not exists qr_scanned_at_delivery timestamptz;

create index if not exists orders_cash_collected_by_driver_idx
  on public.orders (cash_collected_by_driver_id)
  where cash_collected_by_driver_id is not null;

alter table public.cash_handovers
  add column if not exists submitted_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.drivers
  add column if not exists commission_rule_id uuid
    references public.driver_commission_rules (id) on delete set null;

-- Safe view for drivers: operational + own commission snapshot only (no laundry cost / margin / profit)
create or replace view public.driver_order_cards
with (security_invoker = true)
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
  -- Eligible revenue for commission display (after discount) — not laundry/margin
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
left join public.profiles p on p.id = c.profile_id;

comment on view public.driver_order_cards is
  'Driver-safe order projection: no partner cost, contribution, or margin fields.';

revoke all on public.driver_order_cards from anon;
grant select on public.driver_order_cards to authenticated;

-- Drivers may insert their own pending commission row from order snapshot (immutable amounts)
create policy "driver_commissions_insert_own_pending"
  on public.driver_commissions for insert to authenticated
  with check (
    driver_id = private.current_driver_id()
    and status = 'pending'
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          o.pickup_driver_id = private.current_driver_id()
          or o.delivery_driver_id = private.current_driver_id()
        )
    )
  );

-- Helper: generate 6-digit delivery confirmation code
create or replace function public.generate_delivery_confirmation_code()
returns text
language sql
as $$
  select lpad((floor(random() * 1000000))::int::text, 6, '0');
$$;
