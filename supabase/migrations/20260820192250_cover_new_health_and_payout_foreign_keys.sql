create index if not exists producer_payouts_destination_application_idx
  on private.producer_payouts(destination_application_id)
  where destination_application_id is not null;

create index if not exists product_health_change_requests_proposed_by_idx
  on private.product_health_change_requests(proposed_by);

create index if not exists product_health_change_requests_reviewed_by_idx
  on private.product_health_change_requests(reviewed_by)
  where reviewed_by is not null;
