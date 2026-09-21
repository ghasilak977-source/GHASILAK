-- Extend customer-facing order statuses and afternoon/evening pickup slots.
-- Existing statuses remain; new values support the tracking timeline.

alter type public.order_status add value if not exists 'driver_assigned';
alter type public.order_status add value if not exists 'driver_on_way';
alter type public.order_status add value if not exists 'received_at_laundry';
alter type public.order_status add value if not exists 'ironing';
alter type public.order_status add value if not exists 'quality_check';
alter type public.order_status add value if not exists 'ready_for_delivery';

-- Prefer afternoon / evening slots for customer MVP examples
update public.pickup_slots
set is_active = false
where start_time in (time '09:00', time '16:00');

insert into public.pickup_slots (zone_id, day_of_week, start_time, end_time, capacity)
select z.id, d.dow, t.start_time, t.end_time, 30
from public.service_zones z
cross join (values (0), (1), (2), (3), (4), (5), (6)) as d(dow)
cross join (
  values
    (time '14:00', time '17:00'),
    (time '18:00', time '21:00')
) as t(start_time, end_time)
where not exists (
  select 1
  from public.pickup_slots ps
  where ps.zone_id = z.id
    and ps.day_of_week = d.dow
    and ps.start_time = t.start_time
    and ps.end_time = t.end_time
);
