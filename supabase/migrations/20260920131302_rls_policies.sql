-- Row Level Security policies for GHASILAK.
-- Roles: customer, driver, admin, manager, finance.

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.addresses enable row level security;
alter table public.drivers enable row level security;
alter table public.driver_commission_rules enable row level security;
alter table public.laundry_partners enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.service_partner_prices enable row level security;
alter table public.service_zones enable row level security;
alter table public.pickup_slots enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_photos enable row level security;
alter table public.payments enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.driver_commissions enable row level security;
alter table public.driver_settlements enable row level security;
alter table public.driver_settlement_items enable row level security;
alter table public.laundry_settlements enable row level security;
alter table public.laundry_settlement_items enable row level security;
alter table public.cash_handovers enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.business_expenses enable row level security;
alter table public.complaints enable row level security;
alter table public.ratings enable row level security;
alter table public.notifications enable row level security;
alter table public.business_settings enable row level security;
alter table public.audit_logs enable row level security;

-- ========================= profiles =========================
create policy "profiles_select_own_or_staff"
  on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_staff());

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_all"
  on public.profiles for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ========================= customers =========================
create policy "customers_select_own_or_staff"
  on public.customers for select to authenticated
  using (profile_id = auth.uid() or private.is_staff());

create policy "customers_update_own"
  on public.customers for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "customers_staff_insert"
  on public.customers for insert to authenticated
  with check (private.is_staff() or profile_id = auth.uid());

create policy "customers_admin_delete"
  on public.customers for delete to authenticated
  using (private.is_admin());

-- ========================= addresses =========================
create policy "addresses_select_own_or_staff"
  on public.addresses for select to authenticated
  using (
    customer_id = private.current_customer_id()
    or private.is_staff()
    or exists (
      select 1 from public.orders o
      where (o.pickup_address_id = addresses.id or o.delivery_address_id = addresses.id)
        and (
          o.pickup_driver_id = private.current_driver_id()
          or o.delivery_driver_id = private.current_driver_id()
        )
    )
  );

create policy "addresses_insert_own"
  on public.addresses for insert to authenticated
  with check (customer_id = private.current_customer_id() or private.is_staff());

create policy "addresses_update_own"
  on public.addresses for update to authenticated
  using (customer_id = private.current_customer_id() or private.is_staff())
  with check (customer_id = private.current_customer_id() or private.is_staff());

create policy "addresses_delete_own"
  on public.addresses for delete to authenticated
  using (customer_id = private.current_customer_id() or private.is_staff());

-- ========================= drivers =========================
create policy "drivers_select_own_or_staff"
  on public.drivers for select to authenticated
  using (profile_id = auth.uid() or private.is_staff());

create policy "drivers_update_own_limited"
  on public.drivers for update to authenticated
  using (profile_id = auth.uid() or private.is_staff())
  with check (profile_id = auth.uid() or private.is_staff());

create policy "drivers_admin_insert"
  on public.drivers for insert to authenticated
  with check (private.is_admin() or private.current_role() = 'manager');

create policy "drivers_admin_delete"
  on public.drivers for delete to authenticated
  using (private.is_admin());

-- ========================= catalog (public read) =========================
create policy "driver_commission_rules_select_auth"
  on public.driver_commission_rules for select to authenticated
  using (true);

create policy "driver_commission_rules_staff_write"
  on public.driver_commission_rules for all to authenticated
  using (private.is_finance_or_admin())
  with check (private.is_finance_or_admin());

create policy "laundry_partners_select_auth"
  on public.laundry_partners for select to authenticated
  using (status = 'active' or private.is_staff());

create policy "laundry_partners_staff_write"
  on public.laundry_partners for all to authenticated
  using (private.is_staff())
  with check (private.is_staff());

create policy "service_categories_select_anon"
  on public.service_categories for select to anon
  using (is_active = true);

create policy "service_categories_select_auth"
  on public.service_categories for select to authenticated
  using (is_active = true or private.is_staff());

create policy "service_categories_staff_write"
  on public.service_categories for all to authenticated
  using (private.is_staff())
  with check (private.is_staff());

create policy "services_select_anon"
  on public.services for select to anon
  using (is_active = true);

create policy "services_select_auth"
  on public.services for select to authenticated
  using (is_active = true or private.is_staff());

create policy "services_staff_write"
  on public.services for all to authenticated
  using (private.is_staff())
  with check (private.is_staff());

create policy "service_partner_prices_select_auth"
  on public.service_partner_prices for select to authenticated
  using (is_active = true or private.is_staff());

create policy "service_partner_prices_staff_write"
  on public.service_partner_prices for all to authenticated
  using (private.is_staff())
  with check (private.is_staff());

create policy "service_zones_select_anon"
  on public.service_zones for select to anon
  using (is_active = true);

create policy "service_zones_select_auth"
  on public.service_zones for select to authenticated
  using (is_active = true or private.is_staff());

create policy "service_zones_staff_write"
  on public.service_zones for all to authenticated
  using (private.is_staff())
  with check (private.is_staff());

create policy "pickup_slots_select_anon"
  on public.pickup_slots for select to anon
  using (is_active = true);

create policy "pickup_slots_select_auth"
  on public.pickup_slots for select to authenticated
  using (is_active = true or private.is_staff());

create policy "pickup_slots_staff_write"
  on public.pickup_slots for all to authenticated
  using (private.is_staff())
  with check (private.is_staff());

create policy "promo_codes_select_staff"
  on public.promo_codes for select to authenticated
  using (private.is_staff() or (is_active = true));

create policy "promo_codes_staff_write"
  on public.promo_codes for all to authenticated
  using (private.is_finance_or_admin())
  with check (private.is_finance_or_admin());

-- ========================= orders =========================
create policy "orders_select_own_driver_or_staff"
  on public.orders for select to authenticated
  using (
    customer_id = private.current_customer_id()
    or pickup_driver_id = private.current_driver_id()
    or delivery_driver_id = private.current_driver_id()
    or private.is_staff()
  );

create policy "orders_insert_customer_or_staff"
  on public.orders for insert to authenticated
  with check (
    customer_id = private.current_customer_id()
    or private.is_staff()
  );

create policy "orders_update_own_driver_or_staff"
  on public.orders for update to authenticated
  using (
    customer_id = private.current_customer_id()
    or pickup_driver_id = private.current_driver_id()
    or delivery_driver_id = private.current_driver_id()
    or private.is_staff()
  )
  with check (
    customer_id = private.current_customer_id()
    or pickup_driver_id = private.current_driver_id()
    or delivery_driver_id = private.current_driver_id()
    or private.is_staff()
  );

create policy "orders_delete_admin"
  on public.orders for delete to authenticated
  using (private.is_admin());

-- ========================= order_items =========================
create policy "order_items_select_via_order"
  on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          o.customer_id = private.current_customer_id()
          or o.pickup_driver_id = private.current_driver_id()
          or o.delivery_driver_id = private.current_driver_id()
          or private.is_staff()
        )
    )
  );

create policy "order_items_write_customer_or_staff"
  on public.order_items for insert to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.customer_id = private.current_customer_id() or private.is_staff())
    )
  );

create policy "order_items_update_staff_or_customer"
  on public.order_items for update to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.customer_id = private.current_customer_id() or private.is_staff())
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.customer_id = private.current_customer_id() or private.is_staff())
    )
  );

create policy "order_items_delete_staff"
  on public.order_items for delete to authenticated
  using (private.is_staff());

-- ========================= order_status_history =========================
create policy "order_status_history_select"
  on public.order_status_history for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and (
          o.customer_id = private.current_customer_id()
          or o.pickup_driver_id = private.current_driver_id()
          or o.delivery_driver_id = private.current_driver_id()
          or private.is_staff()
        )
    )
  );

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
  );

-- ========================= order_photos =========================
create policy "order_photos_select"
  on public.order_photos for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_photos.order_id
        and (
          o.customer_id = private.current_customer_id()
          or o.pickup_driver_id = private.current_driver_id()
          or o.delivery_driver_id = private.current_driver_id()
          or private.is_staff()
        )
    )
  );

create policy "order_photos_insert"
  on public.order_photos for insert to authenticated
  with check (
    private.is_staff()
    or exists (
      select 1 from public.orders o
      where o.id = order_photos.order_id
        and (
          o.pickup_driver_id = private.current_driver_id()
          or o.delivery_driver_id = private.current_driver_id()
          or o.customer_id = private.current_customer_id()
        )
    )
  );

-- ========================= payments =========================
create policy "payments_select"
  on public.payments for select to authenticated
  using (
    private.is_finance_or_admin()
    or exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and (
          o.customer_id = private.current_customer_id()
          or o.pickup_driver_id = private.current_driver_id()
          or o.delivery_driver_id = private.current_driver_id()
        )
    )
  );

create policy "payments_write_finance_or_driver"
  on public.payments for insert to authenticated
  with check (
    private.is_finance_or_admin()
    or collected_by_driver_id = private.current_driver_id()
  );

create policy "payments_update_finance"
  on public.payments for update to authenticated
  using (private.is_finance_or_admin())
  with check (private.is_finance_or_admin());

-- ========================= promo_redemptions =========================
create policy "promo_redemptions_select"
  on public.promo_redemptions for select to authenticated
  using (customer_id = private.current_customer_id() or private.is_staff());

create policy "promo_redemptions_insert"
  on public.promo_redemptions for insert to authenticated
  with check (customer_id = private.current_customer_id() or private.is_staff());

-- ========================= driver_commissions =========================
create policy "driver_commissions_select"
  on public.driver_commissions for select to authenticated
  using (driver_id = private.current_driver_id() or private.is_finance_or_admin());

create policy "driver_commissions_finance_write"
  on public.driver_commissions for all to authenticated
  using (private.is_finance_or_admin())
  with check (private.is_finance_or_admin());

-- ========================= driver_settlements =========================
create policy "driver_settlements_select"
  on public.driver_settlements for select to authenticated
  using (driver_id = private.current_driver_id() or private.is_finance_or_admin());

create policy "driver_settlements_finance_write"
  on public.driver_settlements for all to authenticated
  using (private.is_finance_or_admin())
  with check (private.is_finance_or_admin());

create policy "driver_settlement_items_select"
  on public.driver_settlement_items for select to authenticated
  using (
    private.is_finance_or_admin()
    or exists (
      select 1 from public.driver_settlements s
      where s.id = driver_settlement_items.settlement_id
        and s.driver_id = private.current_driver_id()
    )
  );

create policy "driver_settlement_items_finance_write"
  on public.driver_settlement_items for all to authenticated
  using (private.is_finance_or_admin())
  with check (private.is_finance_or_admin());

-- ========================= laundry_settlements =========================
create policy "laundry_settlements_finance_all"
  on public.laundry_settlements for all to authenticated
  using (private.is_finance_or_admin())
  with check (private.is_finance_or_admin());

create policy "laundry_settlement_items_finance_all"
  on public.laundry_settlement_items for all to authenticated
  using (private.is_finance_or_admin())
  with check (private.is_finance_or_admin());

-- ========================= cash_handovers =========================
create policy "cash_handovers_select"
  on public.cash_handovers for select to authenticated
  using (driver_id = private.current_driver_id() or private.is_finance_or_admin());

create policy "cash_handovers_insert_driver_or_finance"
  on public.cash_handovers for insert to authenticated
  with check (driver_id = private.current_driver_id() or private.is_finance_or_admin());

create policy "cash_handovers_update_finance"
  on public.cash_handovers for update to authenticated
  using (private.is_finance_or_admin() or driver_id = private.current_driver_id())
  with check (private.is_finance_or_admin() or driver_id = private.current_driver_id());

-- ========================= financial_transactions =========================
create policy "financial_transactions_finance_all"
  on public.financial_transactions for all to authenticated
  using (private.is_finance_or_admin())
  with check (private.is_finance_or_admin());

-- ========================= business_expenses =========================
create policy "business_expenses_finance_all"
  on public.business_expenses for all to authenticated
  using (private.is_finance_or_admin())
  with check (private.is_finance_or_admin());

-- ========================= complaints =========================
create policy "complaints_select"
  on public.complaints for select to authenticated
  using (
    customer_id = private.current_customer_id()
    or opened_by = auth.uid()
    or private.is_staff()
  );

create policy "complaints_insert"
  on public.complaints for insert to authenticated
  with check (
    customer_id = private.current_customer_id()
    or opened_by = auth.uid()
    or private.is_staff()
  );

create policy "complaints_update_staff_or_own"
  on public.complaints for update to authenticated
  using (private.is_staff() or customer_id = private.current_customer_id())
  with check (private.is_staff() or customer_id = private.current_customer_id());

-- ========================= ratings =========================
create policy "ratings_select"
  on public.ratings for select to authenticated
  using (
    customer_id = private.current_customer_id()
    or driver_id = private.current_driver_id()
    or private.is_staff()
  );

create policy "ratings_insert_customer"
  on public.ratings for insert to authenticated
  with check (customer_id = private.current_customer_id() or private.is_staff());

create policy "ratings_update_customer_or_staff"
  on public.ratings for update to authenticated
  using (customer_id = private.current_customer_id() or private.is_staff())
  with check (customer_id = private.current_customer_id() or private.is_staff());

-- ========================= notifications =========================
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (profile_id = auth.uid() or private.is_staff());

create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "notifications_insert_staff"
  on public.notifications for insert to authenticated
  with check (private.is_staff() or profile_id = auth.uid());

-- ========================= business_settings =========================
create policy "business_settings_select_auth"
  on public.business_settings for select to authenticated
  using (true);

create policy "business_settings_select_public_keys"
  on public.business_settings for select to anon
  using (
    key in (
      'brand_name_ar',
      'brand_name_en',
      'currency_code',
      'min_pieces',
      'min_order_omr',
      'default_customer_price_omr',
      'vat_enabled',
      'vat_rate',
      'support_phone',
      'support_whatsapp',
      'support_email',
      'instagram_url',
      'logo_url',
      'terms_url',
      'privacy_url'
    )
  );

create policy "business_settings_admin_write"
  on public.business_settings for all to authenticated
  using (private.is_admin() or private.current_role() = 'manager')
  with check (private.is_admin() or private.current_role() = 'manager');

-- ========================= audit_logs =========================
create policy "audit_logs_admin_select"
  on public.audit_logs for select to authenticated
  using (private.is_admin() or private.current_role() = 'manager');

create policy "audit_logs_insert_authenticated"
  on public.audit_logs for insert to authenticated
  with check (actor_id = auth.uid() or private.is_staff());
