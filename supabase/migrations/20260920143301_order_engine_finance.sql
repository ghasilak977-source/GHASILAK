-- Phase 3: order engine financial snapshots, quantity audit, QR, packaging, unpaid payment status.

-- Payment: support explicit unpaid (spec)
alter type public.payment_status add value if not exists 'unpaid';

-- Business setting for packaging
insert into public.business_settings (key, value, description) values
  ('default_packaging_cost_omr', '0.100', 'Default packaging cost per order in OMR')
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description;

-- Orders: financial + ops columns
alter table public.orders
  add column if not exists vat_rate numeric(5, 2) not null default 0
    check (vat_rate >= 0 and vat_rate <= 100),
  add column if not exists packaging_cost_omr numeric(12, 3) not null default 0
    check (packaging_cost_omr >= 0),
  add column if not exists other_direct_cost_omr numeric(12, 3) not null default 0
    check (other_direct_cost_omr >= 0),
  add column if not exists contribution_omr numeric(12, 3) not null default 0,
  add column if not exists margin_percentage numeric(9, 3) not null default 0,
  add column if not exists estimated_piece_count integer not null default 0
    check (estimated_piece_count >= 0),
  add column if not exists confirmed_piece_count integer
    check (confirmed_piece_count is null or confirmed_piece_count >= 0),
  add column if not exists qr_token text,
  add column if not exists invoice_number text,
  add column if not exists partner_assigned_by uuid references public.profiles (id) on delete set null,
  add column if not exists partner_assignment_note text;

-- Backfill estimated from piece_count where needed
update public.orders
set estimated_piece_count = piece_count
where estimated_piece_count = 0 and piece_count > 0;

create unique index if not exists orders_qr_token_uidx
  on public.orders (qr_token)
  where qr_token is not null;

create unique index if not exists orders_invoice_number_uidx
  on public.orders (invoice_number)
  where invoice_number is not null;

-- Order items: estimated vs confirmed quantity (quantity = effective for money)
alter table public.order_items
  add column if not exists estimated_quantity integer
    check (estimated_quantity is null or estimated_quantity > 0),
  add column if not exists confirmed_quantity integer
    check (confirmed_quantity is null or confirmed_quantity > 0);

update public.order_items
set estimated_quantity = quantity
where estimated_quantity is null;

-- Quantity change audit (never silent overwrite)
create table if not exists public.order_quantity_audits (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  order_item_id uuid references public.order_items (id) on delete set null,
  field_name text not null default 'confirmed_quantity',
  old_quantity integer,
  new_quantity integer not null check (new_quantity >= 0),
  actor_id uuid references public.profiles (id) on delete set null,
  reason text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists order_quantity_audits_order_id_idx
  on public.order_quantity_audits (order_id, created_at desc);

alter table public.order_quantity_audits enable row level security;

create policy "order_quantity_audits_staff_select"
  on public.order_quantity_audits for select to authenticated
  using (private.is_staff());

create policy "order_quantity_audits_staff_insert"
  on public.order_quantity_audits for insert to authenticated
  with check (private.is_staff());

-- Secure QR token generator (opaque — no PII)
create or replace function public.generate_order_qr_token()
returns text
language plpgsql
as $$
begin
  return encode(gen_random_bytes(24), 'hex');
end;
$$;

create or replace function public.generate_invoice_number()
returns text
language plpgsql
as $$
declare
  y text := to_char(timezone('utc', now()), 'YYYY');
  n bigint;
begin
  n := nextval('public.order_number_seq');
  return 'INV-' || y || '-' || lpad(n::text, 6, '0');
end;
$$;

comment on column public.orders.contribution_omr is
  'Snapshot: revenue(net of discount) - laundry - driver commission - packaging - other direct';
comment on column public.orders.qr_token is
  'Opaque secure identifier for QR; never encode phone/address/financials';
comment on column public.orders.subtotal_omr is
  'Frozen customer revenue snapshot at confirm/recalc time';
