-- Phase 6: Full finance ledger, expense categories, settlement integrity.
-- Historical order snapshots remain immutable.

-- ---------------------------------------------------------------------------
-- Extend financial_tx_type with Phase 6 ledger vocabulary
-- ---------------------------------------------------------------------------
alter type public.financial_tx_type add value if not exists 'customer_payment';
alter type public.financial_tx_type add value if not exists 'laundry_payable';
alter type public.financial_tx_type add value if not exists 'laundry_payment';
alter type public.financial_tx_type add value if not exists 'driver_commission';
alter type public.financial_tx_type add value if not exists 'driver_payment';
alter type public.financial_tx_type add value if not exists 'cash_collected';
alter type public.financial_tx_type add value if not exists 'discount';
alter type public.financial_tx_type add value if not exists 'business_expense';
alter type public.financial_tx_type add value if not exists 'owner_contribution';
alter type public.financial_tx_type add value if not exists 'owner_withdrawal';

-- ---------------------------------------------------------------------------
-- Ledger party / method columns
-- ---------------------------------------------------------------------------
alter table public.financial_transactions
  add column if not exists customer_id uuid references public.customers (id) on delete set null,
  add column if not exists driver_id uuid references public.drivers (id) on delete set null,
  add column if not exists laundry_partner_id uuid references public.laundry_partners (id) on delete set null,
  add column if not exists payment_method text,
  add column if not exists notes text,
  add column if not exists reverses_tx_id uuid references public.financial_transactions (id) on delete set null;

create index if not exists financial_transactions_customer_id_idx
  on public.financial_transactions (customer_id);
create index if not exists financial_transactions_driver_id_idx
  on public.financial_transactions (driver_id);
create index if not exists financial_transactions_partner_id_idx
  on public.financial_transactions (laundry_partner_id);
create index if not exists financial_transactions_occurred_at_idx
  on public.financial_transactions (occurred_at desc);

-- Prevent duplicate customer payment ledger rows for same order+amount+type (soft)
create unique index if not exists financial_transactions_unique_order_payment_idx
  on public.financial_transactions (order_id, tx_type, amount_omr)
  where order_id is not null
    and tx_type in ('customer_payment', 'order_payment', 'cash_collected')
    and reverses_tx_id is null;

-- ---------------------------------------------------------------------------
-- Expense categories (enforced for business_expenses; owner withdrawals stay out)
-- ---------------------------------------------------------------------------
create type public.expense_category as enum (
  'instagram_ads',
  'packaging',
  'hosting',
  'software',
  'phone',
  'refund',
  'compensation',
  'transportation',
  'registration',
  'other'
);

alter table public.business_expenses
  add column if not exists expense_category public.expense_category
    not null default 'other';

comment on column public.business_expenses.expense_category is
  'Business expense only — owner withdrawals must use financial_transactions.owner_withdrawal, never this table.';

-- ---------------------------------------------------------------------------
-- Settlement payment metadata
-- ---------------------------------------------------------------------------
alter table public.driver_settlements
  add column if not exists payment_reference text,
  add column if not exists payment_method text;

alter table public.laundry_settlements
  add column if not exists payment_reference text,
  add column if not exists payment_method text;

-- A commission may belong to at most one non-cancelled settlement
create unique index if not exists driver_settlement_items_commission_once_idx
  on public.driver_settlement_items (commission_id);

-- An order may belong to at most one non-cancelled laundry settlement item globally
create unique index if not exists laundry_settlement_items_order_once_idx
  on public.laundry_settlement_items (order_id);

-- ---------------------------------------------------------------------------
-- Integrity: paid settlements cannot be deleted; use reversal/adjustment
-- ---------------------------------------------------------------------------
create or replace function public.prevent_paid_settlement_delete()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'paid' then
    raise exception 'Paid settlements cannot be deleted; use reversal/adjustment';
  end if;
  return old;
end;
$$;

drop trigger if exists driver_settlements_no_paid_delete on public.driver_settlements;
create trigger driver_settlements_no_paid_delete
before delete on public.driver_settlements
for each row execute function public.prevent_paid_settlement_delete();

drop trigger if exists laundry_settlements_no_paid_delete on public.laundry_settlements;
create trigger laundry_settlements_no_paid_delete
before delete on public.laundry_settlements
for each row execute function public.prevent_paid_settlement_delete();

create or replace function public.prevent_paid_settlement_status_downgrade()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'paid' and new.status is distinct from 'paid' then
    raise exception 'Paid settlements are immutable; correct via adjustment ledger entries';
  end if;
  return new;
end;
$$;

drop trigger if exists driver_settlements_paid_immutable on public.driver_settlements;
create trigger driver_settlements_paid_immutable
before update on public.driver_settlements
for each row execute function public.prevent_paid_settlement_status_downgrade();

drop trigger if exists laundry_settlements_paid_immutable on public.laundry_settlements;
create trigger laundry_settlements_paid_immutable
before update on public.laundry_settlements
for each row execute function public.prevent_paid_settlement_status_downgrade();

-- ---------------------------------------------------------------------------
-- Owner capital is never a business expense (app enforces; comment documents)
-- ---------------------------------------------------------------------------
comment on type public.financial_tx_type is
  'Ledger types. owner_withdrawal / owner_contribution are capital movements — not business_expenses.';
