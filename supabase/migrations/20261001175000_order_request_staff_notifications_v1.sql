-- Staff hear about new order requests, and pre-order notices stop failing.
--
-- 1. Every new WhatsApp or Havale/EFT order request now drops an in-app
--    notification (type 'order', so the existing push queue picks it up)
--    for each active staff member who may read orders. The notice carries
--    only the reference, method, line count and total: no name, phone or
--    address, because push previews can show on a locked screen.
-- 2. process_product_sales_windows_v1 inserted notifications with type
--    'product_preorder_open', which the notifications type check rejects,
--    so the first confirmed sales window would have failed the whole worker
--    run. It now uses type 'order' and keeps the event in metadata.kind.

create or replace function private.notify_staff_new_order_request_v1()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  method_label text := case new.method when 'bank_transfer' then 'Havale/EFT' else 'WhatsApp' end;
  total_label text := translate(to_char(new.total_minor / 100.0, 'FM999,999,990.00'), ',.', '.,') || ' TL';
  line_count integer := coalesce(jsonb_array_length(new.items), 0);
begin
  insert into public.notifications(user_id, type, title, message, action_url, metadata)
  select staff.user_id,
         'order',
         'Yeni sipariş talebi ' || new.reference,
         method_label || ' ile ' || line_count || ' kalem, toplam ' || total_label || '. Müşteriyle iletişime geçip onaylayın.',
         '/admin/order-requests',
         jsonb_build_object('kind', 'order_request_new', 'orderRequestId', new.id, 'reference', new.reference, 'method', new.method)
  from (
    select distinct ur.user_id
    from private.user_roles ur
    join private.role_permissions rp on rp.role = ur.role and rp.permission_key = 'order.read'
    where (ur.expires_at is null or ur.expires_at > timezone('utc', now()))
  ) staff
  where private.user_has_permission_v1(staff.user_id, 'order.read');
  return new;
exception when others then
  -- A notification problem must never lose a customer's order.
  raise warning 'order_request_staff_notification_failed:%', sqlerrm;
  return new;
end;
$function$;

revoke all on function private.notify_staff_new_order_request_v1() from public, anon, authenticated;

drop trigger if exists order_requests_notify_staff on private.order_requests;
create trigger order_requests_notify_staff
after insert on private.order_requests
for each row execute function private.notify_staff_new_order_request_v1();

create or replace function private.process_product_sales_windows_v1()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare opened_count integer := 0; closed_count integer := 0; notification_count integer := 0;
begin
  with updated as (
    update public.product_sales_windows w
    set status = 'open', updated_at = timezone('utc', now())
    where w.is_confirmed = true and w.status = 'scheduled' and w.preorder_opens_at is not null
      and w.preorder_opens_at <= timezone('utc', now())
      and (w.preorder_closes_at is null or w.preorder_closes_at > timezone('utc', now()))
    returning id
  ) select count(*) into opened_count from updated;

  with updated as (
    update public.product_sales_windows w
    set status = 'closed', updated_at = timezone('utc', now())
    where w.is_confirmed = true and w.status = 'open' and w.preorder_closes_at is not null
      and w.preorder_closes_at <= timezone('utc', now())
    returning id
  ) select count(*) into closed_count from updated;

  with candidates as (
    select s.id subscription_id, s.user_id, w.id window_id, p.slug, p.name
    from public.product_sales_windows w
    join public.product_availability_subscriptions s on s.product_id = w.product_id and s.active = true and s.notify_on_preorder = true
    join public.products p on p.id = w.product_id
    where w.is_confirmed = true and w.status = 'open' and p.status = 'published' and p.is_active = true and p.deleted_at is null
  ), claimed as (
    insert into private.product_availability_delivery_log(subscription_id, sales_window_id, event_type)
    select c.subscription_id, c.window_id, 'preorder_open' from candidates c
    on conflict do nothing
    returning subscription_id, sales_window_id
  ), messages as (
    select c.user_id, c.slug, c.name, c.window_id
    from candidates c join claimed x on x.subscription_id = c.subscription_id and x.sales_window_id = c.window_id
  ), inserted as (
    insert into public.notifications(user_id, type, title, message, action_url, metadata)
    select m.user_id, 'order', 'Sipariş dönemi açıldı',
           m.name || ' için sipariş dönemi açıldı. Ürün sayfasından hazırlama seçeneklerini seçerek sipariş verebilirsiniz.',
           '/?tab=product-detail&product=' || m.slug,
           jsonb_build_object('kind', 'product_preorder_open', 'productSlug', m.slug, 'salesWindowId', m.window_id)
    from messages m
    returning id
  ) select count(*) into notification_count from inserted;

  return jsonb_build_object('opened', opened_count, 'closed', closed_count, 'notifications', notification_count);
end;
$function$;
