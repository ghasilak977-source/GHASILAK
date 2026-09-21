-- GHASILAK Phase 1: core schema
-- Money: NUMERIC(12,3) for OMR (3 decimal places). Never float for persisted money.

create extension if not exists "pgcrypto";

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.app_role as enum (
  'customer',
  'driver',
  'admin',
  'manager',
  'finance'
);

create type public.preferred_language as enum ('ar', 'en');

create type public.driver_status as enum (
  'pending',
  'active',
  'inactive',
  'suspended'
);

create type public.partner_status as enum (
  'active',
  'inactive',
  'suspended'
);

create type public.order_status as enum (
  'draft',
  'pending',
  'confirmed',
  'pickup_assigned',
  'picked_up',
  'at_laundry',
  'washing',
  'ready',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'failed'
);

create type public.payment_method as enum (
  'cash',
  'card',
  'bank_transfer',
  'wallet',
  'online'
);

create type public.payment_status as enum (
  'pending',
  'authorized',
  'paid',
  'failed',
  'refunded',
  'partially_refunded'
);

create type public.settlement_status as enum (
  'draft',
  'pending',
  'approved',
  'paid',
  'cancelled'
);

create type public.commission_status as enum (
  'pending',
  'approved',
  'settled',
  'cancelled'
);

create type public.cash_handover_status as enum (
  'pending',
  'confirmed',
  'disputed',
  'cancelled'
);

create type public.financial_tx_type as enum (
  'order_payment',
  'refund',
  'driver_settlement',
  'laundry_settlement',
  'cash_handover',
  'expense',
  'adjustment',
  'promo_discount',
  'other'
);

create type public.expense_status as enum (
  'draft',
  'approved',
  'paid',
  'rejected'
);

create type public.complaint_status as enum (
  'open',
  'in_progress',
  'resolved',
  'closed',
  'rejected'
);

create type public.notification_channel as enum (
  'in_app',
  'sms',
  'whatsapp',
  'email',
  'push'
);

create type public.photo_kind as enum (
  'pickup',
  'delivery',
  'damage',
  'other'
);

-- ---------------------------------------------------------------------------
-- Updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public number sequences / generators
-- ---------------------------------------------------------------------------

create sequence if not exists public.order_number_seq start 1;
create sequence if not exists public.laundry_settlement_number_seq start 1;
create sequence if not exists public.driver_settlement_number_seq start 1;

create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
declare
  y text := to_char(timezone('utc', now()), 'YYYY');
  n bigint;
begin
  n := nextval('public.order_number_seq');
  return 'GH-' || y || '-' || lpad(n::text, 6, '0');
end;
$$;

create or replace function public.generate_laundry_settlement_number()
returns text
language plpgsql
as $$
declare
  y text := to_char(timezone('utc', now()), 'YYYY');
  n bigint;
begin
  n := nextval('public.laundry_settlement_number_seq');
  return 'LS-' || y || '-' || lpad(n::text, 6, '0');
end;
$$;

create or replace function public.generate_driver_settlement_number()
returns text
language plpgsql
as $$
declare
  y text := to_char(timezone('utc', now()), 'YYYY');
  n bigint;
begin
  n := nextval('public.driver_settlement_number_seq');
  return 'DS-' || y || '-' || lpad(n::text, 6, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  email text,
  role public.app_role not null default 'customer',
  preferred_language public.preferred_language not null default 'ar',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_phone_unique unique (phone),
  constraint profiles_email_unique unique (email)
);

create index profiles_role_idx on public.profiles (role);
create index profiles_phone_idx on public.profiles (phone);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  notes text,
  default_address_id uuid,
  total_orders integer not null default 0 check (total_orders >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- addresses
-- ---------------------------------------------------------------------------

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  label text,
  area_code text not null,
  area_name_en text not null,
  area_name_ar text not null,
  street text,
  building text,
  floor text,
  unit text,
  landmark text,
  wilayat text,
  governorate text not null default 'Muscat',
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index addresses_customer_id_idx on public.addresses (customer_id);
create index addresses_area_code_idx on public.addresses (area_code);

create trigger addresses_set_updated_at
before update on public.addresses
for each row execute function public.set_updated_at();

alter table public.customers
  add constraint customers_default_address_id_fkey
  foreign key (default_address_id) references public.addresses (id) on delete set null;

-- ---------------------------------------------------------------------------
-- drivers
-- ---------------------------------------------------------------------------

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  status public.driver_status not null default 'pending',
  vehicle_type text,
  vehicle_plate text,
  license_number text,
  national_id text,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  is_available boolean not null default false,
  current_latitude numeric(10, 7),
  current_longitude numeric(10, 7),
  notes text,
  hired_at date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index drivers_status_idx on public.drivers (status);
create index drivers_is_available_idx on public.drivers (is_available);

create trigger drivers_set_updated_at
before update on public.drivers
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- driver_commission_rules
-- ---------------------------------------------------------------------------

create table public.driver_commission_rules (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text not null,
  commission_percent numeric(5, 2) not null check (commission_percent >= 0 and commission_percent <= 100),
  flat_amount_omr numeric(12, 3) not null default 0 check (flat_amount_omr >= 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint driver_commission_rules_dates_chk check (
    effective_to is null or effective_to >= effective_from
  )
);

create unique index driver_commission_rules_one_default_idx
  on public.driver_commission_rules (is_default)
  where is_default = true;

create trigger driver_commission_rules_set_updated_at
before update on public.driver_commission_rules
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- laundry_partners
-- ---------------------------------------------------------------------------

create table public.laundry_partners (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  area_code text not null,
  area_name_en text not null,
  area_name_ar text not null,
  contact_name text,
  contact_phone text,
  contact_email text,
  address_line text,
  status public.partner_status not null default 'active',
  default_cost_per_piece_omr numeric(12, 3) not null default 0.200
    check (default_cost_per_piece_omr >= 0),
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index laundry_partners_status_idx on public.laundry_partners (status);
create index laundry_partners_area_code_idx on public.laundry_partners (area_code);

create trigger laundry_partners_set_updated_at
before update on public.laundry_partners
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- service_categories
-- ---------------------------------------------------------------------------

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger service_categories_set_updated_at
before update on public.service_categories
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.service_categories (id) on delete set null,
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  default_customer_price_omr numeric(12, 3) not null default 0.400
    check (default_customer_price_omr >= 0),
  default_partner_cost_omr numeric(12, 3) not null default 0.200
    check (default_partner_cost_omr >= 0),
  is_special_item boolean not null default false,
  unit_label_en text not null default 'piece',
  unit_label_ar text not null default 'قطعة',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index services_category_id_idx on public.services (category_id);
create index services_is_active_idx on public.services (is_active);

create trigger services_set_updated_at
before update on public.services
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- service_partner_prices (partner-specific overrides)
-- ---------------------------------------------------------------------------

create table public.service_partner_prices (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  partner_id uuid not null references public.laundry_partners (id) on delete cascade,
  customer_price_omr numeric(12, 3) not null check (customer_price_omr >= 0),
  partner_cost_omr numeric(12, 3) not null check (partner_cost_omr >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint service_partner_prices_unique unique (service_id, partner_id)
);

create index service_partner_prices_partner_id_idx
  on public.service_partner_prices (partner_id);

create trigger service_partner_prices_set_updated_at
before update on public.service_partner_prices
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- service_zones (coverage areas)
-- ---------------------------------------------------------------------------

create table public.service_zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  governorate_en text not null default 'Muscat',
  governorate_ar text not null default 'مسقط',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  default_partner_id uuid references public.laundry_partners (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index service_zones_is_active_idx on public.service_zones (is_active);

create trigger service_zones_set_updated_at
before update on public.service_zones
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- pickup_slots
-- ---------------------------------------------------------------------------

create table public.pickup_slots (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references public.service_zones (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  capacity integer not null default 20 check (capacity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pickup_slots_time_chk check (end_time > start_time)
);

create index pickup_slots_zone_id_idx on public.pickup_slots (zone_id);
create index pickup_slots_day_of_week_idx on public.pickup_slots (day_of_week);

create trigger pickup_slots_set_updated_at
before update on public.pickup_slots
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- promo_codes
-- ---------------------------------------------------------------------------

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description_en text,
  description_ar text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12, 3) not null check (discount_value >= 0),
  max_discount_omr numeric(12, 3) check (max_discount_omr is null or max_discount_omr >= 0),
  min_order_omr numeric(12, 3) not null default 0 check (min_order_omr >= 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint promo_codes_window_chk check (
    starts_at is null or ends_at is null or ends_at >= starts_at
  )
);

create trigger promo_codes_set_updated_at
before update on public.promo_codes
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- orders (financial snapshots frozen at order time)
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default public.generate_order_number(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  partner_id uuid references public.laundry_partners (id) on delete set null,
  pickup_driver_id uuid references public.drivers (id) on delete set null,
  delivery_driver_id uuid references public.drivers (id) on delete set null,
  pickup_address_id uuid references public.addresses (id) on delete set null,
  delivery_address_id uuid references public.addresses (id) on delete set null,
  zone_id uuid references public.service_zones (id) on delete set null,
  status public.order_status not null default 'pending',
  preferred_language public.preferred_language not null default 'ar',
  pickup_slot_id uuid references public.pickup_slots (id) on delete set null,
  scheduled_pickup_at timestamptz,
  scheduled_delivery_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  piece_count integer not null default 0 check (piece_count >= 0),
  -- Snapshot money fields (immutable history; do not rewrite from live prices)
  subtotal_omr numeric(12, 3) not null default 0 check (subtotal_omr >= 0),
  discount_omr numeric(12, 3) not null default 0 check (discount_omr >= 0),
  delivery_fee_omr numeric(12, 3) not null default 0 check (delivery_fee_omr >= 0),
  vat_omr numeric(12, 3) not null default 0 check (vat_omr >= 0),
  total_omr numeric(12, 3) not null default 0 check (total_omr >= 0),
  partner_cost_total_omr numeric(12, 3) not null default 0 check (partner_cost_total_omr >= 0),
  driver_commission_percent numeric(5, 2),
  driver_commission_omr numeric(12, 3) not null default 0 check (driver_commission_omr >= 0),
  currency_code text not null default 'OMR',
  promo_code_id uuid references public.promo_codes (id) on delete set null,
  payment_method public.payment_method,
  payment_status public.payment_status not null default 'pending',
  customer_notes text,
  internal_notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index orders_customer_id_idx on public.orders (customer_id);
create index orders_partner_id_idx on public.orders (partner_id);
create index orders_status_idx on public.orders (status);
create index orders_pickup_driver_id_idx on public.orders (pickup_driver_id);
create index orders_delivery_driver_id_idx on public.orders (delivery_driver_id);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_payment_status_idx on public.orders (payment_status);

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- order_items (line-level price snapshots)
-- ---------------------------------------------------------------------------

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  service_code text not null,
  service_name_en text not null,
  service_name_ar text not null,
  quantity integer not null check (quantity > 0),
  unit_price_omr numeric(12, 3) not null check (unit_price_omr >= 0),
  partner_unit_cost_omr numeric(12, 3) not null check (partner_unit_cost_omr >= 0),
  line_total_omr numeric(12, 3) not null check (line_total_omr >= 0),
  partner_line_cost_omr numeric(12, 3) not null check (partner_line_cost_omr >= 0),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_service_id_idx on public.order_items (service_id);

create trigger order_items_set_updated_at
before update on public.order_items
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- order_status_history
-- ---------------------------------------------------------------------------

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index order_status_history_order_id_idx
  on public.order_status_history (order_id, created_at desc);

-- ---------------------------------------------------------------------------
-- order_photos
-- ---------------------------------------------------------------------------

create table public.order_photos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  kind public.photo_kind not null default 'other',
  storage_path text not null,
  caption text,
  created_at timestamptz not null default timezone('utc', now())
);

create index order_photos_order_id_idx on public.order_photos (order_id);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  amount_omr numeric(12, 3) not null check (amount_omr >= 0),
  currency_code text not null default 'OMR',
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  provider text,
  provider_reference text,
  collected_by_driver_id uuid references public.drivers (id) on delete set null,
  collected_by_profile_id uuid references public.profiles (id) on delete set null,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index payments_order_id_idx on public.payments (order_id);
create index payments_status_idx on public.payments (status);

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- promo_redemptions
-- ---------------------------------------------------------------------------

create table public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes (id) on delete restrict,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  discount_omr numeric(12, 3) not null check (discount_omr >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  constraint promo_redemptions_unique_per_order unique (promo_code_id, order_id)
);

create index promo_redemptions_customer_id_idx on public.promo_redemptions (customer_id);
create index promo_redemptions_promo_code_id_idx on public.promo_redemptions (promo_code_id);

-- ---------------------------------------------------------------------------
-- driver_commissions
-- ---------------------------------------------------------------------------

create table public.driver_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  driver_id uuid not null references public.drivers (id) on delete restrict,
  commission_rule_id uuid references public.driver_commission_rules (id) on delete set null,
  commission_percent numeric(5, 2) not null check (commission_percent >= 0 and commission_percent <= 100),
  base_amount_omr numeric(12, 3) not null check (base_amount_omr >= 0),
  commission_omr numeric(12, 3) not null check (commission_omr >= 0),
  status public.commission_status not null default 'pending',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint driver_commissions_order_driver_unique unique (order_id, driver_id)
);

create index driver_commissions_driver_id_idx on public.driver_commissions (driver_id);
create index driver_commissions_status_idx on public.driver_commissions (status);

create trigger driver_commissions_set_updated_at
before update on public.driver_commissions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- driver_settlements
-- ---------------------------------------------------------------------------

create table public.driver_settlements (
  id uuid primary key default gen_random_uuid(),
  settlement_number text not null unique default public.generate_driver_settlement_number(),
  driver_id uuid not null references public.drivers (id) on delete restrict,
  period_start date not null,
  period_end date not null,
  status public.settlement_status not null default 'draft',
  gross_commission_omr numeric(12, 3) not null default 0 check (gross_commission_omr >= 0),
  deductions_omr numeric(12, 3) not null default 0 check (deductions_omr >= 0),
  net_amount_omr numeric(12, 3) not null default 0 check (net_amount_omr >= 0),
  currency_code text not null default 'OMR',
  paid_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint driver_settlements_period_chk check (period_end >= period_start)
);

create index driver_settlements_driver_id_idx on public.driver_settlements (driver_id);
create index driver_settlements_status_idx on public.driver_settlements (status);

create trigger driver_settlements_set_updated_at
before update on public.driver_settlements
for each row execute function public.set_updated_at();

create table public.driver_settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.driver_settlements (id) on delete cascade,
  commission_id uuid not null references public.driver_commissions (id) on delete restrict,
  amount_omr numeric(12, 3) not null check (amount_omr >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  constraint driver_settlement_items_unique unique (settlement_id, commission_id)
);

create index driver_settlement_items_settlement_id_idx
  on public.driver_settlement_items (settlement_id);

-- ---------------------------------------------------------------------------
-- laundry_settlements
-- ---------------------------------------------------------------------------

create table public.laundry_settlements (
  id uuid primary key default gen_random_uuid(),
  settlement_number text not null unique default public.generate_laundry_settlement_number(),
  partner_id uuid not null references public.laundry_partners (id) on delete restrict,
  period_start date not null,
  period_end date not null,
  status public.settlement_status not null default 'draft',
  gross_cost_omr numeric(12, 3) not null default 0 check (gross_cost_omr >= 0),
  deductions_omr numeric(12, 3) not null default 0 check (deductions_omr >= 0),
  net_amount_omr numeric(12, 3) not null default 0 check (net_amount_omr >= 0),
  currency_code text not null default 'OMR',
  paid_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint laundry_settlements_period_chk check (period_end >= period_start)
);

create index laundry_settlements_partner_id_idx on public.laundry_settlements (partner_id);
create index laundry_settlements_status_idx on public.laundry_settlements (status);

create trigger laundry_settlements_set_updated_at
before update on public.laundry_settlements
for each row execute function public.set_updated_at();

create table public.laundry_settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.laundry_settlements (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete restrict,
  amount_omr numeric(12, 3) not null check (amount_omr >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  constraint laundry_settlement_items_unique unique (settlement_id, order_id)
);

create index laundry_settlement_items_settlement_id_idx
  on public.laundry_settlement_items (settlement_id);

-- ---------------------------------------------------------------------------
-- cash_handovers
-- ---------------------------------------------------------------------------

create table public.cash_handovers (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete restrict,
  received_by uuid references public.profiles (id) on delete set null,
  amount_omr numeric(12, 3) not null check (amount_omr >= 0),
  currency_code text not null default 'OMR',
  status public.cash_handover_status not null default 'pending',
  handed_over_at timestamptz,
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index cash_handovers_driver_id_idx on public.cash_handovers (driver_id);
create index cash_handovers_status_idx on public.cash_handovers (status);

create trigger cash_handovers_set_updated_at
before update on public.cash_handovers
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- financial_transactions (ledger)
-- ---------------------------------------------------------------------------

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  tx_type public.financial_tx_type not null,
  amount_omr numeric(12, 3) not null,
  currency_code text not null default 'OMR',
  direction text not null check (direction in ('in', 'out')),
  order_id uuid references public.orders (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  driver_settlement_id uuid references public.driver_settlements (id) on delete set null,
  laundry_settlement_id uuid references public.laundry_settlements (id) on delete set null,
  cash_handover_id uuid references public.cash_handovers (id) on delete set null,
  reference text,
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index financial_transactions_tx_type_idx on public.financial_transactions (tx_type);
create index financial_transactions_occurred_at_idx
  on public.financial_transactions (occurred_at desc);
create index financial_transactions_order_id_idx on public.financial_transactions (order_id);

-- ---------------------------------------------------------------------------
-- business_expenses
-- ---------------------------------------------------------------------------

create table public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text not null,
  amount_omr numeric(12, 3) not null check (amount_omr >= 0),
  currency_code text not null default 'OMR',
  status public.expense_status not null default 'draft',
  incurred_on date not null default current_date,
  vendor_name text,
  receipt_path text,
  approved_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index business_expenses_status_idx on public.business_expenses (status);
create index business_expenses_incurred_on_idx on public.business_expenses (incurred_on desc);

create trigger business_expenses_set_updated_at
before update on public.business_expenses
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- complaints
-- ---------------------------------------------------------------------------

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  opened_by uuid references public.profiles (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  subject text not null,
  description text not null,
  status public.complaint_status not null default 'open',
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index complaints_order_id_idx on public.complaints (order_id);
create index complaints_customer_id_idx on public.complaints (customer_id);
create index complaints_status_idx on public.complaints (status);

create trigger complaints_set_updated_at
before update on public.complaints
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ratings
-- ---------------------------------------------------------------------------

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  driver_id uuid references public.drivers (id) on delete set null,
  partner_id uuid references public.laundry_partners (id) on delete set null,
  overall_score smallint not null check (overall_score between 1 and 5),
  driver_score smallint check (driver_score is null or driver_score between 1 and 5),
  laundry_score smallint check (laundry_score is null or laundry_score between 1 and 5),
  comment text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index ratings_customer_id_idx on public.ratings (customer_id);
create index ratings_driver_id_idx on public.ratings (driver_id);
create index ratings_partner_id_idx on public.ratings (partner_id);

create trigger ratings_set_updated_at
before update on public.ratings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  channel public.notification_channel not null default 'in_app',
  title_en text not null,
  title_ar text not null,
  body_en text not null,
  body_ar text not null,
  data jsonb not null default '{}'::jsonb,
  order_id uuid references public.orders (id) on delete set null,
  is_read boolean not null default false,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index notifications_profile_id_idx on public.notifications (profile_id, created_at desc);
create index notifications_is_read_idx on public.notifications (profile_id, is_read);

-- ---------------------------------------------------------------------------
-- business_settings (key/value with typed value column)
-- ---------------------------------------------------------------------------

create table public.business_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger business_settings_set_updated_at
before update on public.business_settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now())
);

create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

comment on table public.orders is
  'Financial amounts are snapshots at order time; live price changes must not rewrite history.';
comment on column public.orders.total_omr is 'OMR NUMERIC(12,3) snapshot';
comment on column public.order_items.unit_price_omr is 'Customer unit price snapshot in OMR';
comment on column public.order_items.partner_unit_cost_omr is 'Partner unit cost snapshot in OMR';
