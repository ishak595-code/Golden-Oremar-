alter table public.events
  drop constraint if exists events_sale_mode_price_consistency_check;

alter table public.events
  add constraint events_sale_mode_price_consistency_check
  check (
    (sale_mode = 'reservation' and ticket_price_minor = 0)
    or
    (sale_mode = 'ticketed' and ticket_price_minor > 0)
  );
