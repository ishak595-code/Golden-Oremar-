-- Harden the product-commerce tables without widening direct client access.
-- RPCs remain the only customer/admin mutation/read boundary for these records.

create index if not exists product_availability_delivery_log_sales_window_idx
  on private.product_availability_delivery_log(sales_window_id);
create index if not exists order_item_preparation_events_actor_idx
  on public.order_item_preparation_events(actor_user_id)
  where actor_user_id is not null;
create index if not exists product_commerce_profiles_updated_by_idx
  on public.product_commerce_profiles(updated_by)
  where updated_by is not null;
create index if not exists product_sales_windows_updated_by_idx
  on public.product_sales_windows(updated_by)
  where updated_by is not null;

drop policy if exists product_commerce_profiles_deny_direct on public.product_commerce_profiles;
create policy product_commerce_profiles_deny_direct
  on public.product_commerce_profiles
  for all to public
  using (false)
  with check (false);

drop policy if exists product_sales_windows_deny_direct on public.product_sales_windows;
create policy product_sales_windows_deny_direct
  on public.product_sales_windows
  for all to public
  using (false)
  with check (false);

drop policy if exists product_availability_subscriptions_deny_direct on public.product_availability_subscriptions;
create policy product_availability_subscriptions_deny_direct
  on public.product_availability_subscriptions
  for all to public
  using (false)
  with check (false);

drop policy if exists order_item_preparation_events_deny_direct on public.order_item_preparation_events;
create policy order_item_preparation_events_deny_direct
  on public.order_item_preparation_events
  for all to public
  using (false)
  with check (false);
