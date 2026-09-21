-- GHASILAK seed data (partners, zones, services, commission defaults, business settings)

-- Default driver commission: 15%
insert into public.driver_commission_rules (
  name_en, name_ar, commission_percent, flat_amount_omr, is_default, is_active, notes
) values (
  'Default driver commission',
  'عمولة السائق الافتراضية',
  15.00,
  0.000,
  true,
  true,
  'Default marketplace driver commission rate'
)
on conflict do nothing;

-- Partners
insert into public.laundry_partners (
  code, name_en, name_ar, area_code, area_name_en, area_name_ar,
  contact_phone, status, default_cost_per_piece_omr
) values
  (
    'ANSAB',
    'Ansab Laundry',
    'مغسلة الأنصب',
    'al_ansab',
    'Al Ansab',
    'الأنصب',
    '+96890000001',
    'active',
    0.200
  ),
  (
    'AMERAT',
    'Amerat Laundry',
    'مغسلة العامرات',
    'al_amerat',
    'Al Amerat',
    'العامرات',
    '+96890000002',
    'active',
    0.200
  )
on conflict (code) do update set
  name_en = excluded.name_en,
  name_ar = excluded.name_ar,
  default_cost_per_piece_omr = excluded.default_cost_per_piece_omr,
  status = excluded.status;

-- Service zones / areas
insert into public.service_zones (
  code, name_en, name_ar, sort_order, default_partner_id
) values
  ('al_ansab', 'Al Ansab', 'الأنصب', 1,
    (select id from public.laundry_partners where code = 'ANSAB')),
  ('ghala', 'Ghala', 'غلا', 2,
    (select id from public.laundry_partners where code = 'ANSAB')),
  ('bausher', 'Bausher', 'بوشر', 3,
    (select id from public.laundry_partners where code = 'ANSAB')),
  ('al_khuwair', 'Al Khuwair', 'الخوير', 4,
    (select id from public.laundry_partners where code = 'ANSAB')),
  ('al_ghubrah', 'Al Ghubrah', 'الغبرة', 5,
    (select id from public.laundry_partners where code = 'ANSAB')),
  ('azaiba', 'Azaiba', 'العذيبة', 6,
    (select id from public.laundry_partners where code = 'ANSAB')),
  ('al_amerat', 'Al Amerat', 'العامرات', 7,
    (select id from public.laundry_partners where code = 'AMERAT'))
on conflict (code) do update set
  name_en = excluded.name_en,
  name_ar = excluded.name_ar,
  default_partner_id = excluded.default_partner_id,
  is_active = true;

-- Service category
insert into public.service_categories (code, name_en, name_ar, sort_order)
values ('standard_wash', 'Standard wash & fold', 'غسيل وكي قياسي', 1)
on conflict (code) do update set
  name_en = excluded.name_en,
  name_ar = excluded.name_ar;

-- Services (default 0.400 customer / 0.200 partner)
insert into public.services (
  category_id, code, name_en, name_ar,
  default_customer_price_omr, default_partner_cost_omr, sort_order
)
select
  c.id,
  s.code,
  s.name_en,
  s.name_ar,
  0.400,
  0.200,
  s.sort_order
from public.service_categories c
cross join (
  values
    ('dishdasha', 'Dishdasha', 'دشداشة', 1),
    ('shirt', 'Shirt', 'قميص', 2),
    ('t_shirt', 'T-Shirt', 'تي شيرت', 3),
    ('trousers', 'Trousers', 'بنطلون', 4),
    ('jeans', 'Jeans', 'جينز', 5),
    ('wizar', 'Wizar', 'وزار', 6),
    ('kumma', 'Kumma', 'كمة', 7),
    ('abaya', 'Abaya', 'عباية', 8)
) as s(code, name_en, name_ar, sort_order)
where c.code = 'standard_wash'
on conflict (code) do update set
  name_en = excluded.name_en,
  name_ar = excluded.name_ar,
  default_customer_price_omr = excluded.default_customer_price_omr,
  default_partner_cost_omr = excluded.default_partner_cost_omr,
  is_active = true;

-- Partner price matrix for both partners × all services
insert into public.service_partner_prices (
  service_id, partner_id, customer_price_omr, partner_cost_omr
)
select
  s.id,
  p.id,
  0.400,
  0.200
from public.services s
cross join public.laundry_partners p
where p.code in ('ANSAB', 'AMERAT')
on conflict (service_id, partner_id) do update set
  customer_price_omr = excluded.customer_price_omr,
  partner_cost_omr = excluded.partner_cost_omr,
  is_active = true;

-- Basic weekday pickup slots (all zones): 09:00-12:00 and 16:00-20:00
insert into public.pickup_slots (zone_id, day_of_week, start_time, end_time, capacity)
select z.id, d.dow, t.start_time, t.end_time, 25
from public.service_zones z
cross join (values (0), (1), (2), (3), (4), (5), (6)) as d(dow)
cross join (
  values
    (time '09:00', time '12:00'),
    (time '16:00', time '20:00')
) as t(start_time, end_time)
where not exists (
  select 1
  from public.pickup_slots ps
  where ps.zone_id = z.id
    and ps.day_of_week = d.dow
    and ps.start_time = t.start_time
    and ps.end_time = t.end_time
);

-- Business settings defaults
insert into public.business_settings (key, value, description) values
  ('brand_name_ar', '"غسيلك"', 'Arabic brand name'),
  ('brand_name_en', '"GHASILAK"', 'English brand name'),
  ('currency_code', '"OMR"', 'ISO currency code'),
  ('currency_decimals', '3', 'OMR always uses 3 decimal places'),
  ('min_pieces', '8', 'Minimum pieces per order'),
  ('min_order_omr', '3.200', 'Minimum order total in OMR'),
  ('default_customer_price_omr', '0.400', 'Default customer price per piece'),
  ('default_laundry_cost_omr', '0.200', 'Default partner cost per piece'),
  ('default_driver_commission_percent', '15', 'Default driver commission percent'),
  ('default_packaging_cost_omr', '0.100', 'Default packaging cost per order'),
  ('vat_enabled', 'false', 'Whether VAT is applied'),
  ('vat_rate', '5', 'VAT rate percent when enabled'),
  ('support_phone', '"+96800000000"', 'Support phone number'),
  ('support_whatsapp', '"+96800000000"', 'WhatsApp support number'),
  ('support_email', '"support@ghasilak.om"', 'Support email'),
  ('instagram_url', '"https://instagram.com/ghasilak"', 'Instagram profile URL'),
  ('logo_url', '"/brand/ghasilak-logo.png"', 'Brand logo path'),
  ('packaging_notes_en', '"Items returned on hangers where applicable."', 'Packaging notes EN'),
  ('packaging_notes_ar', '"تُعاد القطع على علاقات عند الحاجة."', 'Packaging notes AR'),
  ('terms_url', '"/terms"', 'Terms of service path'),
  ('privacy_url', '"/privacy"', 'Privacy policy path'),
  ('support_hours_en', '"Daily 8:00 – 22:00"', 'Support hours EN'),
  ('support_hours_ar', '"يومياً ٨:٠٠ – ٢٢:٠٠"', 'Support hours AR')
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description;
