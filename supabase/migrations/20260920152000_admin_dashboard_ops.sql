-- Phase 5: Admin dashboard schema extensions (complaint types, zone ops fields).
-- Settings/price changes never rewrite historical order snapshots.

create type public.complaint_type as enum (
  'late_delivery',
  'missing_item',
  'damaged_item',
  'poor_cleaning',
  'payment_issue',
  'other'
);

alter table public.complaints
  add column if not exists complaint_type public.complaint_type not null default 'other',
  add column if not exists compensation_omr numeric(12, 3) not null default 0
    check (compensation_omr >= 0),
  add column if not exists refund_transaction_id uuid
    references public.financial_transactions (id) on delete set null;

-- Align complaint_status with product language: investigating ≈ in_progress
-- (existing enum already has in_progress / resolved / rejected / closed / open)

alter table public.service_zones
  add column if not exists min_order_omr numeric(12, 3),
  add column if not exists delivery_fee_omr numeric(12, 3) not null default 0
    check (delivery_fee_omr >= 0),
  add column if not exists estimated_turnaround_hours integer
    check (estimated_turnaround_hours is null or estimated_turnaround_hours > 0);

comment on column public.service_zones.min_order_omr is
  'Optional zone minimum; null falls back to business_settings.min_order_omr';
comment on column public.service_zones.delivery_fee_omr is
  'Zone delivery fee snapshot source for new orders only';

-- Ensure investigating alias via view comment (UI maps in_progress → investigating)
comment on type public.complaint_status is
  'open | in_progress (investigating) | resolved | closed | rejected';
