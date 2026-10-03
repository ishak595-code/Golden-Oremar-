-- Post-delivery review request + Turkish order status labels in notifications.
-- 1) When an order becomes 'delivered', the customer receives one in-app/push
--    notification inviting them to rate the delivered products (no reviews are created).
-- 2) Order status notifications no longer expose raw status codes such as
--    "delivered"; the code is replaced with a Turkish label before insert, so the
--    push queue (AFTER INSERT) also sends the Turkish text.

create or replace function private.order_status_label_tr_v1(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(coalesce(p_status, ''))
    when 'draft' then 'Taslak'
    when 'pending_payment' then 'Ödeme bekleniyor'
    when 'confirmed' then 'Onaylandı'
    when 'preparing' then 'Hazırlanıyor'
    when 'partially_shipped' then 'Kısmen kargoya verildi'
    when 'shipped' then 'Kargoya verildi'
    when 'delivered' then 'Teslim edildi'
    when 'completed' then 'Tamamlandı'
    when 'cancelled' then 'İptal edildi'
    when 'refunded' then 'İade edildi'
    else null
  end;
$$;

create or replace function private.localize_order_status_notification_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text := new.metadata->>'status';
  v_label text := private.order_status_label_tr_v1(v_status);
begin
  if new.type in ('order', 'shipment')
     and v_label is not null
     and new.message like '% numaralı siparişinizin yeni durumu: ' || v_status || '.' then
    new.message := left(new.message, char_length(new.message) - char_length(v_status) - 1) || v_label || '.';
  end if;
  return new;
end;
$$;

drop trigger if exists localize_order_status_notification_v1 on public.notifications;
create trigger localize_order_status_notification_v1
before insert on public.notifications
for each row execute function private.localize_order_status_notification_v1();

create or replace function private.notify_order_delivered_review_request_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null then
    return new;
  end if;
  if exists (
    select 1 from public.notifications n
    where n.user_id = new.user_id
      and n.metadata->>'kind' = 'review_request'
      and n.metadata->>'reviewOrderId' = new.id::text
  ) then
    return new;
  end if;
  insert into public.notifications(user_id, type, title, message, action_url, metadata)
  values (
    new.user_id,
    'review',
    'Siparişiniz teslim edildi',
    coalesce(new.order_number, 'Son') || ' numaralı siparişiniz teslim edildi. Ürünleri puanlayıp deneyiminizi paylaşarak diğer müşterilere yol gösterebilirsiniz.',
    '/account/reviews',
    jsonb_build_object('kind', 'review_request', 'reviewOrderId', new.id)
  );
  return new;
end;
$$;

revoke all on function private.notify_order_delivered_review_request_v1() from public;
revoke all on function private.localize_order_status_notification_v1() from public;

drop trigger if exists notify_order_delivered_review_request_v1 on public.orders;
create trigger notify_order_delivered_review_request_v1
after update of status on public.orders
for each row
when (new.status = 'delivered' and old.status is distinct from new.status)
execute function private.notify_order_delivered_review_request_v1();
